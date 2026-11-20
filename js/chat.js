import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, serverTimestamp, query, where, orderBy, onSnapshot, limit } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCEaZ4ik3gcMScg23FVS99OLKxUnB8LHsY",
  authDomain: "uikimodder-65617.firebaseapp.com",
  projectId: "uikimodder-65617",
  storageBucket: "uikimodder-65617.firebasestorage.app",
  messagingSenderId: "597231043468",
  appId: "1:597231043468:web:380a56d46e741cd45b8ca9"
};
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const $ = (s) => document.querySelector(s);
const ADMIN_EMAIL = "abdullahcheemakv@gmail.com";
let currentUser = null, currentProfile = null, activeChatId = null;
let chatListUnsub = null, messagesUnsub = null, activeChatUnsub = null, directory = [];

function safe(value="") {
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function nameOf(user) {
  return String(user.displayName || user.email?.split("@")[0] || "UIKIMODDER Member").trim().slice(0,40);
}
function dateOf(value) {
  const d = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleString([], {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}) : "Just now";
}
function chatIdFor(a,b) { return [a,b].sort().join("__"); }
function stopChatWatchers() {
  chatListUnsub?.(); messagesUnsub?.(); activeChatUnsub?.();
  chatListUnsub = messagesUnsub = activeChatUnsub = null;
}
function setStatus(message, error=false) { $("#authStatus").textContent = message; $("#authStatus").style.color = error ? "#ff8d9d" : "#65e9ed"; }

async function syncProfile(user) {
  const profile = { uid:user.uid, displayName:nameOf(user), updatedAt:serverTimestamp() };
  await setDoc(doc(db,"users",user.uid),profile,{merge:true});
  currentProfile = { uid:user.uid, displayName:nameOf(user) };
}
function renderPeople(items) {
  const box=$("#searchResults");
  if (!items.length) { box.innerHTML = '<div class="chat-empty"><small>No matching members found.</small></div>'; return; }
  box.innerHTML=items.map(p=>'<button class="person-row" type="button" data-user="'+safe(p.uid)+'"><span class="person-avatar">'+safe((p.displayName||"U").charAt(0).toUpperCase())+'</span><span class="person-info"><b>'+safe(p.displayName||"Member")+'</b><small>'+(p.uid===currentUser.uid?"You": "Start private chat")+'</small></span></button>').join("");
}
async function loadDirectory() {
  const snap=await getDocs(query(collection(db,"users"),limit(200)));
  directory=snap.docs.map(d=>d.data()).filter(p=>p.uid && p.uid!==currentUser.uid);
  $("#searchResults").innerHTML='<div class="chat-empty"><small>Search members by name.</small></div>';
}
function renderChatList(items) {
  const box=$("#chatList");
  if(!items.length){box.innerHTML='<div class="chat-empty"><small>Your chats will appear here.</small></div>';return;}
  box.innerHTML=items.map(c=>{
    const other=(c.participants||[]).find(uid=>uid!==currentUser.uid);
    const personName=c.participantNames?.[other]||"UIKIMODDER Member";
    return '<button type="button" class="chat-row '+(c.id===activeChatId?"active":"")+'" data-chat="'+safe(c.id)+'"><span class="chat-avatar">'+safe(personName.charAt(0).toUpperCase())+'</span><span class="chat-info"><b>'+safe(personName)+'</b><small>'+safe(c.lastMessage||"Open conversation")+'</small></span></button>';
  }).join("");
}
function watchChatList() {
  chatListUnsub?.();
  const q=query(collection(db,"directChats"),where("participants","array-contains",currentUser.uid),limit(100));
  chatListUnsub=onSnapshot(q,snap=>{
    const items=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>{
      const av=a.lastMessageAt?.toMillis?.()||0,bv=b.lastMessageAt?.toMillis?.()||0;return bv-av;
    });
    renderChatList(items);
  },err=>{console.error(err);$("#chatList").innerHTML='<div class="chat-empty"><small>Could not load chats. Check Firestore rules.</small></div>';});
}
async function openChat(otherUid) {
  if(!otherUid || otherUid===currentUser.uid) return;
  const other=directory.find(p=>p.uid===otherUid);
  if(!other) { setStatus("Member profile not found. Ask them to sign in to UIKIMODDER first.",true); return; }
  const id=chatIdFor(currentUser.uid,otherUid), ref=doc(db,"directChats",id);
  const names={}; names[currentUser.uid]=currentProfile.displayName; names[otherUid]=other.displayName||"Member";
  const snap=await getDoc(ref);
  if(!snap.exists()) await setDoc(ref,{participants:[currentUser.uid,otherUid].sort(),participantNames:names,createdAt:serverTimestamp(),lastMessage:"",lastMessageAt:serverTimestamp()});
  activeChatId=id;
  $("#conversationHead").innerHTML='<span class="chat-avatar">'+safe((other.displayName||"M").charAt(0).toUpperCase())+'</span><div><b>'+safe(other.displayName||"Member")+'</b><small>Private conversation</small></div>';
  $("#messageInput").disabled=false; $("#messageForm button").disabled=false;
  messagesUnsub?.();
  const q=query(collection(db,"directChats",id,"messages"),orderBy("createdAt","asc"),limit(300));
  messagesUnsub=onSnapshot(q,snap=>{
    const box=$("#messages");
    if(snap.empty){box.innerHTML='<div class="chat-empty"><strong>Say hello!</strong><small>Your messages are private between these two accounts.</small></div>';return;}
    box.innerHTML=snap.docs.map(d=>{
      const m=d.data(), mine=m.senderUid===currentUser.uid;
      return '<article class="message '+(mine?"mine":"")+'"><b>'+safe(m.senderName||"Member")+'</b><p>'+safe(m.text)+'</p><time>'+safe(dateOf(m.createdAt))+'</time></article>';
    }).join("");
    box.scrollTop=box.scrollHeight;
  },err=>{console.error(err);$("#messages").innerHTML='<div class="chat-empty"><small>Messages could not load. Check Firestore rules.</small></div>';});
  watchChatList();
}
$("#memberSearch").addEventListener("input",()=>{
  const term=$("#memberSearch").value.trim().toLowerCase();
  if(!term){renderPeople([]);return;}
  renderPeople(directory.filter(p=>(p.displayName||"").toLowerCase().includes(term)).slice(0,30));
});
$("#searchResults").addEventListener("click",async e=>{
  const button=e.target.closest("[data-user]");if(!button)return;
  try{await openChat(button.dataset.user);}catch(err){console.error(err);alert("Could not start chat. Check Firestore rules and try again.");}
});
$("#chatList").addEventListener("click",async e=>{
  const button=e.target.closest("[data-chat]");if(!button)return;
  const snap=await getDoc(doc(db,"directChats",button.dataset.chat));
  if(!snap.exists())return;
  const other=(snap.data().participants||[]).find(uid=>uid!==currentUser.uid);
  if(!directory.some(p=>p.uid===other)){
    const p=await getDoc(doc(db,"users",other));
    if(p.exists())directory.push(p.data());
  }
  await openChat(other);
});
$("#messageForm").addEventListener("submit",async e=>{
  e.preventDefault();const input=$("#messageInput"),button=e.currentTarget.querySelector("button");
  const text=input.value.trim();if(!text||!activeChatId)return;
  button.disabled=true;
  try{
    const chatRef=doc(db,"directChats",activeChatId);
    await addDoc(collection(db,"directChats",activeChatId,"messages"),{
      text,senderUid:currentUser.uid,senderName:currentProfile.displayName,createdAt:serverTimestamp()
    });
    await updateDoc(chatRef,{lastMessage:text.slice(0,140),lastMessageAt:serverTimestamp()});
    input.value="";
  }catch(err){console.error(err);alert("Message could not be sent. Please check Firestore rules.");}
  finally{button.disabled=false;input.focus();}
});
$("#chatAuthForm").addEventListener("submit",async e=>{
  e.preventDefault();const button=e.currentTarget.querySelector("button");button.disabled=true;setStatus("Signing in...");
  try{await signInWithEmailAndPassword(auth,$("#chatEmail").value.trim(),$("#chatPassword").value);}
  catch(err){console.error(err);setStatus(err.code==="auth/invalid-credential"?"Email or password is incorrect.":err.message,true);}
  finally{button.disabled=false;}
});
onAuthStateChanged(auth,async user=>{
  currentUser=user;stopChatWatchers();
  $("#authPanel").classList.toggle("hidden",!!user);
  $("#messenger").classList.toggle("hidden",!user);
  if(!user)return;
  try{await syncProfile(user);await loadDirectory();watchChatList();}
  catch(err){console.error(err);alert("Could not load the member directory. Please check Firestore rules.");}
});
