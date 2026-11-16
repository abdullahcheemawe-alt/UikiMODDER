import {initializeApp,getApps,getApp} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";
import {getAuth,onAuthStateChanged,signOut} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
import {getFirestore,collection,addDoc,getDocs,query,orderBy,serverTimestamp} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";
import {getStorage,ref,uploadBytes,getDownloadURL} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-storage.js";
const ADMIN="abdullahcheemakv@gmail.com";
const config={apiKey:"AIzaSyCEaZ4ik3gcMScg23FVS99OLKxUnB8LHsY",authDomain:"uikimodder-65617.firebaseapp.com",projectId:"uikimodder-65617",storageBucket:"uikimodder-65617.firebasestorage.app",messagingSenderId:"597231043468",appId:"1:597231043468:web:380a56d46e741cd45b8ca9"};
const app=getApps().length?getApp():initializeApp(config),auth=getAuth(app),db=getFirestore(app),storage=getStorage(app);
const $=s=>document.querySelector(s);let allowed=false;
const status=(s,bad=false)=>{$("#status").textContent=s;$("#status").style.color=bad?"#ff8298":"#00e5ff"};
onAuthStateChanged(auth,async user=>{if(!user){location.replace("./index.html");return}if((user.email||"").toLowerCase()!==ADMIN){await signOut(auth);location.replace("./index.html");return}allowed=true;loadItems()});
$("#signOutBtn").onclick=async()=>{await signOut(auth);location.replace("./index.html")};
$("#uploadForm").addEventListener("submit",async e=>{e.preventDefault();if(!allowed||auth.currentUser?.email?.toLowerCase()!==ADMIN)return;
const type=$("#type").value,name=$("#name").value.trim(),description=$("#description").value.trim(),category=$("#category").value,p=$("#package").files[0],s1=$("#shot1").files[0],s2=$("#shot2").files[0];
if(!p||!s1||!s2)return status("Package aur dono screenshots select karein.",true);
if(p.size>500*1024*1024)return status("Package 500 MB se bara hai.",true);
if(![s1,s2].every(x=>x.type.startsWith("image/")&&x.size<=12*1024*1024))return status("Screenshots image hon aur 12 MB se chhote hon.",true);
const btn=$("#uploadBtn");btn.disabled=true;status("Uploading files…");
try{const uid=auth.currentUser.uid,id=crypto.randomUUID(),base="published/"+uid+"/"+id;
async function put(file,path,type){const r=ref(storage,path);await uploadBytes(r,file,{contentType:type||file.type});return getDownloadURL(r)}
const [downloadUrl,imageUrl,screenshot2Url]=await Promise.all([put(p,base+"/package/"+p.name.replace(/[^\w.-]/g,"_"),p.type||"application/octet-stream"),put(s1,base+"/screenshots/1-"+s1.name.replace(/[^\w.-]/g,"_")),put(s2,base+"/screenshots/2-"+s2.name.replace(/[^\w.-]/g,"_"))]);
await addDoc(collection(db,"games"),{name,description,category,type,downloadUrl,imageUrl,screenshot1Url:imageUrl,screenshot2Url,fileName:p.name,fileSize:p.size,active:true,published:true,createdBy:uid,createdAt:serverTimestamp()});
$("#uploadForm").reset();status("Successfully published!");await loadItems()
}catch(err){console.error(err);status("Upload failed: "+(err.message||err.code),true)}finally{btn.disabled=false}
});
async function loadItems(){try{const snap=await getDocs(query(collection(db,"games"),orderBy("createdAt","desc")));$("#items").replaceChildren();if(!snap.size){$("#items").textContent="No published items yet.";return}snap.forEach(d=>{const x=d.data(),el=document.createElement("div");el.className="row";const title=document.createElement("b");title.textContent=(x.type||"game").toUpperCase()+" — "+(x.name||"Untitled");const desc=document.createElement("p");desc.textContent=x.description||"";el.append(title,desc);$("#items").append(el)})}catch(e){$("#items").textContent="Unable to load. Check Firestore rules."}}
