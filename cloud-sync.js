/* Firebase Google sign-in + private per-user cloud sync.
   This module stays dormant until firebase-config.js contains a real Web App config. */
const FITCHECK_FIREBASE_VERSION = "13.1.0";
const CLOUD_OWNER_KEY = "fitcheck-cloud-owner";
const CONFIG = window.FITCHECK_FIREBASE_CONFIG || {};
const REQUIRED = ["apiKey","authDomain","projectId","appId"];
const isConfigured = REQUIRED.every(key => {
  const value = String(CONFIG[key] || "");
  return value && !/PASTE_|YOUR_PROJECT|REPLACE_ME/i.test(value);
});
const bridge = window.FitCheckBridge;
let auth, db, storage, currentUser, dataRef, unsubscribeSnapshot;
let queueTimer = null;
let isWriting = false;
let dirty = false;
let applyingRemote = false;
let lastFingerprint = "";
let pendingPhotoUploads = 0;
let uiStatus = { title: "Checking cloud setup…", description: "Preparing your private FitCheck account.", mode: "local" };

function cloneData(value) { return JSON.parse(JSON.stringify(value)); }
function fingerprint(value) {
  const copy = cloneData(value || {});
  copy.progressPhotos = (copy.progressPhotos || []).map(photo => ({
    id: photo.id, date: photo.date, label: photo.label, url: photo.url || ""
  }));
  return JSON.stringify(copy);
}
function hasLocalData(value) {
  const d = value || {};
  return Boolean(
    (d.profile && (d.profile.name || d.profile.height || d.profile.currentWeight)) ||
    ["meals","workouts","weighIns","reminders","routines","savedMeals","customFoods","plannedMeals","measurements","progressPhotos"]
      .some(key => Array.isArray(d[key]) && d[key].length) ||
    (d.waterByDate && Object.keys(d.waterByDate).length)
  );
}
function mergeLists(localList, cloudList) {
  const result = [], seen = new Set();
  [...(cloudList || []), ...(localList || [])].forEach(item => {
    const key = item && item.id ? String(item.id) : JSON.stringify(item);
    if (!seen.has(key)) { seen.add(key); result.push(item); }
  });
  return result;
}
function mergeStates(local, cloud) {
  const a = local || {}, b = cloud || {};
  const result = { ...bridge.getEmptyState(), ...a, ...b,
    profile: (() => {
      const localProfile = a.profile || {}, cloudProfile = b.profile || {};
      const cloudHasIdentity = Boolean(cloudProfile.name || cloudProfile.height || cloudProfile.currentWeight);
      return { ...localProfile, ...(cloudHasIdentity ? cloudProfile : {}) };
    })(),
    targets: { ...(a.targets || {}), ...(b.targets || {}) },
    waterByDate: { ...(a.waterByDate || {}), ...(b.waterByDate || {}) }
  };
  ["meals","workouts","weighIns","reminders","routines","savedMeals","customFoods","plannedMeals","measurements","progressPhotos"]
    .forEach(key => { result[key] = mergeLists(a[key], b[key]); });
  return result;
}
function hydrateCloudState(value) {
  const state = { ...bridge.getEmptyState(), ...(value || {}) };
  state.progressPhotos = (state.progressPhotos || []).map(photo => ({
    ...photo, url: photo.url || "", data: photo.url || photo.data || ""
  }));
  return state;
}
function paintStatus(title, description, mode = "local") {
  uiStatus = { title, description, mode };
  const titleNode = document.getElementById("cloud-status-title");
  const descriptionNode = document.getElementById("cloud-status-copy");
  const dot = document.getElementById("cloud-status-dot");
  if (titleNode) titleNode.textContent = title;
  if (descriptionNode) descriptionNode.textContent = description;
  if (dot) dot.dataset.mode = mode;
  const top = document.getElementById("cloud-top-btn");
  if (top) {
    top.textContent = currentUser ? "✓ Synced" : (isConfigured ? "Connect Google" : "Set up sync");
    top.dataset.cloudAction = currentUser ? "sync-now" : "login";
    top.title = currentUser ? "Sync your FitCheck data" : "Connect your Google account";
  }
  document.querySelectorAll("[data-cloud-action='logout']").forEach(node => node.hidden = !currentUser);
  document.querySelectorAll("[data-cloud-action='sync-now']").forEach(node => {
    if (node.id !== "cloud-top-btn") node.hidden = !currentUser;
  });
  document.querySelectorAll("[data-cloud-action='login']").forEach(node => {
    if (node.id !== "cloud-top-btn") {
      node.textContent = currentUser ? "Connected" : (isConfigured ? "Continue with Google" : "Firebase setup required");
      node.disabled = Boolean(currentUser) || !isConfigured;
    }
  });
}
function notify(message) { if (bridge && bridge.notify) bridge.notify(message); }
function stopSnapshot() {
  if (unsubscribeSnapshot) unsubscribeSnapshot();
  unsubscribeSnapshot = null;
}
function photoDataToBlob(dataUrl) {
  const parts = dataUrl.split(",");
  const match = parts[0].match(/data:(.*?);base64/);
  const mime = match ? match[1] : "image/jpeg";
  const binary = atob(parts[1] || "");
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mime });
}
async function prepareForCloud(snapshot) {
  const copy = cloneData(snapshot);
  const photos = [];
  pendingPhotoUploads = 0;
  for (const photo of copy.progressPhotos || []) {
    try {
      let url = photo.url || "";
      if (!url && photo.data && (photo.data.startsWith("http://") || photo.data.startsWith("https://"))) url = photo.data;
      if (!url && photo.data && photo.data.startsWith("data:")) {
        const { getStorage, ref: storageRef, uploadBytes, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/" + FITCHECK_FIREBASE_VERSION + "/firebase-storage.js");
        storage = storage || getStorage(auth.app);
        const objectRef = storageRef(storage, "users/" + currentUser.uid + "/progress-photos/" + encodeURIComponent(photo.id) + ".jpg");
        await uploadBytes(objectRef, photoDataToBlob(photo.data), { contentType: "image/jpeg" });
        url = await getDownloadURL(objectRef);
        photo.url = url;
      }
      if (url) photos.push({ id: photo.id, date: photo.date, label: photo.label, url });
      else pendingPhotoUploads++;
    } catch (error) {
      console.warn("Progress photo remains on this device until cloud storage is available:", error);
      pendingPhotoUploads++;
    }
  }
  copy.progressPhotos = photos;
  const localPhotoState = (snapshot.progressPhotos || []).map(photo => ({
    id: photo.id, date: photo.date, label: photo.label, url: photo.url || ""
  }));
  if (JSON.stringify(photos) !== JSON.stringify(localPhotoState)) {
    const localCopy = cloneData(snapshot);
    localCopy.progressPhotos = (localCopy.progressPhotos || []).map(photo => {
      const found = photos.find(item => item.id === photo.id);
      return found ? { ...photo, url: found.url } : photo;
    });
    applyingRemote = true;
    bridge.applyCloudState(localCopy);
    applyingRemote = false;
  }
  return copy;
}
async function writeCloudState() {
  if (!currentUser || !dataRef || isWriting || !dirty) return;
  isWriting = true;
  const starting = bridge.getState();
  try {
    const cloudState = await prepareForCloud(starting);
    await window.FitCheckFirebase.setDoc(dataRef, {
      schemaVersion: 1,
      state: cloudState,
      updatedAt: window.FitCheckFirebase.serverTimestamp()
    });
    lastFingerprint = fingerprint(bridge.getState());
    dirty = false;
    paintStatus(pendingPhotoUploads ? "Fitness data synced · photos waiting" : "Cloud sync is on",
      pendingPhotoUploads
        ? "Your profile, food and workouts are synced. " + pendingPhotoUploads + " progress photo(s) remain on this device until Firebase Storage is enabled."
        : "Signed in as " + currentUser.email + " · Your latest changes are saved.", pendingPhotoUploads ? "warning" : "online");
    if (fingerprint(bridge.getState()) !== fingerprint(starting) && !dirty) queueSync(250);
  } catch (error) {
    console.error("FitCheck cloud sync failed:", error);
    paintStatus("Saved on this device", "Cloud sync paused: " + (error.message || "connection issue") + ". Your local copy is safe.", "warning");
  } finally {
    isWriting = false;
  }
}
function queueSync(delay = 850) {
  if (!currentUser || applyingRemote) return;
  dirty = true;
  paintStatus("Syncing your changes…", "Your latest entries are being uploaded securely.", "syncing");
  clearTimeout(queueTimer);
  queueTimer = setTimeout(writeCloudState, delay);
}
async function beginUserSync(user) {
  stopSnapshot();
  currentUser = user;
  dirty = false;
  paintStatus("Connecting your account…", "Preparing your private FitCheck space.", "syncing");
  const previousOwner = localStorage.getItem(CLOUD_OWNER_KEY);
  let localState = bridge.getState();
  if (previousOwner && previousOwner !== user.uid) localState = bridge.getEmptyState();
  const { doc, getDoc, setDoc, onSnapshot, serverTimestamp } = window.FitCheckFirebase;
  dataRef = doc(db, "users", user.uid, "fitcheck", "main");
  const snap = await getDoc(dataRef);
  let nextState;
  if (snap.exists()) nextState = mergeStates(localState, hydrateCloudState((snap.data() || {}).state));
  else nextState = localState;
  applyingRemote = true;
  bridge.applyCloudState(nextState);
  applyingRemote = false;
  localStorage.setItem(CLOUD_OWNER_KEY, user.uid);
  dirty = true;
  await writeCloudState();
  lastFingerprint = fingerprint(bridge.getState());
  unsubscribeSnapshot = onSnapshot(dataRef, snapshot => {
    if (!snapshot.exists()) return;
    const remote = hydrateCloudState((snapshot.data() || {}).state);
    const local = bridge.getState();
    const remoteHash = fingerprint(remote);
    if (remoteHash === fingerprint(local) || remoteHash === lastFingerprint) return;
    if (dirty) {
      const merged = mergeStates(local, remote);
      applyingRemote = true;
      bridge.applyCloudState(merged);
      applyingRemote = false;
      queueSync(350);
    } else {
      const localOnlyPhotos = (local.progressPhotos || []).filter(photo =>
        !photo.url && typeof photo.data === "string" && photo.data.startsWith("data:")
      );
      const latestWithLocalPhotos = {
        ...remote,
        progressPhotos: mergeLists(localOnlyPhotos, remote.progressPhotos || [])
      };
      applyingRemote = true;
      bridge.applyCloudState(latestWithLocalPhotos);
      applyingRemote = false;
      lastFingerprint = remoteHash;
      paintStatus("Cloud sync is on", "Latest data received from your other device." +
        (localOnlyPhotos.length ? " Unuploaded progress photos remain safely on this device." : ""), localOnlyPhotos.length ? "warning" : "online");
    }
  }, error => {
    console.error("FitCheck sync listener:", error);
    paintStatus("Sync connection interrupted", error.message || "Reconnect to sync your devices.", "warning");
  });
  paintStatus("Cloud sync is on", "Signed in as " + user.email + " · Your records are syncing.", "online");
}
async function bootCloud() {
  if (!bridge) return;
  if (!isConfigured) {
    paintStatus("Google sync needs setup", "Add your Firebase Web App config in firebase-config.js, then enable Google sign-in and deploy the security rules.", "local");
    return;
  }
  try {
    const base = "https://www.gstatic.com/firebasejs/" + FITCHECK_FIREBASE_VERSION + "/";
    const [appSdk, authSdk, dbSdk] = await Promise.all([
      import(base + "firebase-app.js"),
      import(base + "firebase-auth.js"),
      import(base + "firebase-firestore.js")
    ]);
    const app = appSdk.initializeApp(CONFIG);
    window.FitCheckAuth = authSdk;
    auth = authSdk.getAuth(app);
    db = dbSdk.getFirestore(app);
    window.FitCheckFirebase = { ...dbSdk, serverTimestamp: dbSdk.serverTimestamp };
    await authSdk.setPersistence(auth, authSdk.browserLocalPersistence);
    await authSdk.getRedirectResult(auth).catch(() => null);
    authSdk.onAuthStateChanged(auth, async user => {
      if (!user) {
        stopSnapshot();
        currentUser = null;
        dataRef = null;
        paintStatus("Not connected", "Sign in with the same Google account on each device to sync your data.", "local");
        return;
      }
      try { await beginUserSync(user); }
      catch (error) {
        console.error("FitCheck sign-in sync:", error);
        paintStatus("Could not connect cloud data", error.message || "Check Firebase setup and security rules.", "warning");
      }
    });
  } catch (error) {
    console.error("FitCheck Firebase initialisation:", error);
    paintStatus("Firebase setup error", error.message || "Check firebase-config.js and your project settings.", "warning");
  }
}
async function signIn() {
  if (!isConfigured || !auth) {
    notify("Google sync is not active yet. Complete the Firebase setup in the FitCheck README first.");
    if (bridge.openSettings) bridge.openSettings();
    return;
  }
  const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = window.FitCheckAuth;
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try { await signInWithPopup(auth, provider); }
  catch (error) {
    if (["auth/popup-blocked","auth/operation-not-supported-in-this-environment"].includes(error.code)) {
      try { await signInWithRedirect(auth, provider); }
      catch (redirectError) { notify("Google sign-in could not open: " + redirectError.message); }
    } else notify("Google sign-in failed: " + error.message);
  }
}
document.addEventListener("click", async event => {
  const button = event.target.closest("[data-cloud-action]");
  if (!button) return;
  const action = button.dataset.cloudAction;
  if (action === "login") await signIn();
  if (action === "sync-now" && currentUser) { queueSync(0); notify("Sync requested."); }
  if (action === "logout" && auth && currentUser) {
    if (!confirm("Sign out of FitCheck on this device? Your cloud records will remain in your Google account.")) return;
    try { await window.FitCheckAuth.signOut(auth); notify("Signed out. Your local copy remains on this device."); }
    catch (error) { notify("Could not sign out: " + error.message); }
  }
});
window.addEventListener("online", () => { if (currentUser) queueSync(250); });
window.addEventListener("focus", () => { if (currentUser && dirty) queueSync(250); });
window.FitCheckCloud = {
  queueSync,
  signIn,
  getUser: () => currentUser ? { uid: currentUser.uid, email: currentUser.email, displayName: currentUser.displayName } : null,
  isConfigured: () => isConfigured,
  refreshStatus: () => paintStatus(uiStatus.title, uiStatus.description, uiStatus.mode)
};
bootCloud();