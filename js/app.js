const auth=firebase.auth(),db=firebase.firestore(),TS=()=>firebase.firestore.FieldValue.serverTimestamp();
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
const ENR=['Enrolled','Pending','Not Enrolled','Transferred','Withdrawn'],MOD=['Face-to-Face','Blended Learning','Modular','Online','Other'],DST=['Pending','Submitted','Verified','Not Required'],PST=['Not Yet Issued','Issued','Claimed','Pending','Not Required'];
const DOCS=['Birth Certificate','Card','JHS Certificate','Good Moral Certificate','2x2 Picture','SF10','Others','VPB Folder','Annex E/F','Attachment'];
const OPT=['schoolYears','clusters','sections','advisers','electives'];
const NAV={admin:['dash','records','new','reports','settings','users','audit'],registrar:['dash','records','new','reports'],custodian:['dash','records','reports'],viewer:['dash','records']};
const LBL={dash:'Dashboard',records:'Student records',new:'Student encoding',reports:'Reports',settings:'Settings',users:'User management',audit:'Audit logs'};
let me,O={},cur={sy:'',term:1},busy=false,rec={q:'',cursors:[null],page:0},ST=null;
function toast(m,e){const t=$('#toast');t.textContent=m;t.className=e?'err':'';t.style.display='block';setTimeout(()=>t.style.display='none',3500)}
const log=(action,id)=>db.collection('auditLogs').add({uid:me.uid,name:me.name,action,id,at:TS()}).catch(()=>{});
async function guard(fn){if(busy)return;busy=true;try{await fn()}catch(e){toast('Could not complete the action: '+(e.code||'check your connection and permissions'),1)}finally{busy=false}}
async function signIn(){try{await auth.signInWithEmailAndPassword($('#em').value,$('#pw').value)}catch(e){$('#lerr').textContent='Sign-in failed. Check your email and password.'}}
auth.onAuthStateChanged(async u=>{
 if(!u){$('#app').style.display='none';$('#login').style.display='block';return}
 try{const d=await db.collection('users').doc(u.uid).get();
  if(!d.exists||!d.data().active){await auth.signOut();$('#lerr').textContent='Your account is not active. Contact the administrator.';return}
  me={uid:u.uid,...d.data()};
  for(const t of OPT){const s=await db.collection(t).orderBy('name').get();O[t]=s.docs.map(x=>({id:x.id,...x.data()}))}
  const c=await db.collection('settings').doc('current').get();cur=c.exists?c.data():{sy:(O.schoolYears.find(x=>x.active)||{}).name||'',term:1};
  $('#login').style.display='none';$('#app').style.display='flex';
  $('#menu').innerHTML=NAV[me.role].map(k=>`<a id="n-${k}" onclick="go('${k}')">${LBL[k]}</a>`).join('');go('dash');
 }catch(e){toast('Cannot load. Check connection, config and rules.',1)}});
function go(k,a){document.querySelectorAll('nav a').forEach(x=>x.classList.toggle('on',x.id==='n-'+k));({dash,records,new:()=>student(null),reports,settings,users,audit})[k](a)}
const can=(...r)=>r.includes(me.role),names=t=>O[t].filter(x=>x.active).map(x=>x.name);
// ---------- form helpers ----------
function inp(k,type,v,dis){v=v??'';const d=dis?'disabled':'',a=`data-k="${k}" ${d}`;
 if(type.startsWith('sel:')||type.startsWith('opt:')){let l=type.startsWith('opt:')?names(type.slice(4)):type.slice(4).split(',');if(v&&!l.includes(v))l=[...l,v];
  return`<select ${a}><option value=""></option>${l.map(x=>`<option ${x===v?'selected':''}>${esc(x)}</option>`).join('')}</select>`}
 if(type==='area')return`<textarea rows="2" ${a}>${esc(v)}</textarea>`;
 return`<input type="${type||'text'}" value="${esc(v)}" ${type==='number'?'step="any" min="0"':''} ${a}>`}
const fld=(k,l,t,v,dis)=>`<div><label>${l}</label>${inp(k,t,v,dis)}</div>`;
const collect=el=>{const o={};el.querySelectorAll('[data-k]').forEach(i=>o[i.dataset.k]=i.type==='number'&&i.value!==''?Number(i.value):i.value.trim());return o};
const fmt=ts=>ts&&ts.toDate?ts.toDate().toLocaleString():'';
const full=s=>[s.lastName+',',s.firstName,s.middleName,s.suffix].filter(Boolean).join(' ');
const docPct=d=>{if(!d)return'0/10';const n=DOCS.filter(x=>['Submitted','Verified','Not Required'].includes(d['d_'+x])).length;return n+'/10'};
// ---------- dashboard ----------
async function dash(){
 $('#main').innerHTML=`<h2>Dashboard</h2><div class="row noprint"><input id="sq" placeholder="Search by last name or LRN"><button onclick="rec.q=$('#sq').value.trim();rec.cursors=[null];rec.page=0;go('records')">Search</button><span>School year <b>${esc(cur.sy)||'not set'}</b>, Term ${cur.term}</span></div><div class="grid" id="st"></div><div class="card" style="margin-top:1rem"><h3>Recent record updates</h3><div id="rc">Loading…</div></div>`;
 const C=q=>q.count().get().then(s=>s.data().count);
 const E=db.collection('enrollments').where('sy','==',cur.sy).where('term','==',cur.term);
 try{const [a,b]=await Promise.all([C(db.collection('students').where('archived','==',false)),C(E.where('status','==','Enrolled'))]);
 $('#st').innerHTML=`<div class="card stat"><b>${a}</b>Total students</div><div class="card stat"><b>${b}</b>Currently enrolled</div>`;
 const r=await db.collection('students').orderBy('updatedAt','desc').limit(6).get();
 $('#rc').innerHTML=r.docs.map(d=>`<div>${esc(full(d.data()))} <small>${fmt(d.data().updatedAt)}</small></div>`).join('')||'No records yet.'}catch(e){toast('Could not load statistics.',1)}}
// ---------- records ----------
async function records(){
 $('#main').innerHTML=`<h2>Student records</h2><div class="row noprint"><input id="rq" value="${esc(rec.q)}" placeholder="Last name (starts with) or exact LRN"><button onclick="rec.q=$('#rq').value.trim();rec.cursors=[null];rec.page=0;records()">Search</button>${can('admin','registrar')?'<button class="gold" onclick="go(\'new\')">New student</button>':''}</div><div class="wrap" id="rt">Loading…</div><div class="row noprint" style="margin-top:.6rem"><button class="alt" id="pv">Previous</button><span id="pg"></span><button class="alt" id="nx">Next</button></div>`;
 let q=db.collection('students');const t=rec.q;
 if(/^\d{6,}$/.test(t))q=q.where('lrn','==',t);else{q=q.orderBy('lastNameLower');if(t)q=q.where('lastNameLower','>=',t.toLowerCase()).where('lastNameLower','<=',t.toLowerCase()+'\uf8ff')}
 if(rec.cursors[rec.page])q=q.startAfter(rec.cursors[rec.page]);
 try{const s=await q.limit(15).get(),rows=s.docs.map(d=>({id:d.id,...d.data()})).filter(x=>!x.archived);
  const k=id=>db.collection(id[0]).doc(id[1]).get().then(x=>x.exists?x.data():null).catch(()=>null);
  const ex=await Promise.all(rows.map(async r=>[await k(['enrollments',`${r.id}_${cur.sy}_T${cur.term}`]),await k(['registrarDocuments',r.id]),await k(['propertyRecords',r.id])]));
  $('#rt').innerHTML=`<table><tr><th>ID</th><th>LRN</th><th>Name</th><th>Gender</th><th>Contact</th><th>Cluster</th><th>Section</th><th>Status</th><th>Docs</th><th>School ID</th><th></th></tr>`+rows.map((r,i)=>{const[e,d,p]=ex[i];
   return`<tr><td>${r.id.slice(0,6).toUpperCase()}</td><td>${esc(r.lrn)}</td><td>${esc(full(r))}</td><td>${esc(r.gender)}</td><td>${esc(r.contact)}</td><td>${esc(e?.cluster)}</td><td>${esc(e?.section)}</td><td>${esc(e?.status)}</td><td>${docPct(d)}</td><td>${esc(p?.idStatus||'—')}</td><td style="white-space:nowrap"><button class="alt" onclick="student('${r.id}')">Open</button> ${can('admin')?`<button class="alt" onclick="archive('${r.id}')">Archive</button>`:''}</td></tr>`}).join('')+'</table>'+(rows.length?'':'<p>No matching records.</p>');
  $('#pg').textContent='Page '+(rec.page+1)+' · '+rows.length+' shown';
  $('#pv').disabled=rec.page===0;$('#pv').onclick=()=>{rec.page--;records()};
  $('#nx').disabled=s.docs.length<15;$('#nx').onclick=()=>{rec.cursors[rec.page+1]=s.docs[s.docs.length-1];rec.page++;records()};
 }catch(e){$('#rt').textContent='Could not load records. Check your connection, then try again.'}}
function archive(id){if(!confirm('Archive this student record? It will be hidden from lists but not deleted.'))return;guard(async()=>{await db.collection('students').doc(id).update({archived:true,updatedAt:TS()});log('archive student',id);toast('Record archived');records()})}
// ---------- student hub ----------
const PF=['#Student identification','lrn|LRN','lastName|Last name','firstName|First name','middleName|Middle name','suffix|Suffix','gender|Gender|sel:Male,Female','birthdate|Birthdate (MM/DD/YYYY)|date','birthplace|Birthplace','#Contact information','contact|Contact number|tel','fb|Facebook name','email|Email / Gmail|email','address|Present address|area','#Emergency contact','ecName|Contact person','ecRel|Relationship','ecNo|Contact number|tel','ecAddr|Address','#Parents / guardian','mother|Mother\'s name','motherNo|Mother\'s contact|tel','father|Father\'s name','fatherNo|Father\'s contact|tel'];
const formOf=(fs,o,dis)=>fs.map(f=>f[0]==='#'?`<h3>${f.slice(1)}</h3>`:(([k,l,t])=>fld(k,l,t||'text',o[k],dis))(f.split('|'))).join('');
async function student(id,tab='profile'){
 ST={id,tab,s:{},e:{},d:null,p:null};
 try{if(id){const s=await db.collection('students').doc(id).get();ST.s=s.data()||{};
  for(let n=1;n<=3;n++){const e=await db.collection('enrollments').doc(`${id}_${cur.sy}_T${n}`).get();ST.e[n]=e.exists?e.data():{}}
  ST.d=(await db.collection('registrarDocuments').doc(id).get()).data()||{};ST.p=(await db.collection('propertyRecords').doc(id).get()).data()||{}}}catch(e){return toast('Could not load the student.',1)}
 const T=id?[['profile','Profile',1],['enroll','Enrollment',1],['docs','Documents',1],['prop','Property',1]]:[['profile','Profile']];
 $('#main').innerHTML=`<button class="alt noprint" onclick="go('records')">Back to records</button><h2 style="margin-top:.6rem">${id?esc(full(ST.s)):'New student'}</h2>${id?`<div class="tabs noprint">${T.map(t=>`<button class="${t[0]===tab?'on':''}" onclick="student('${id}','${t[0]}')">${t[1]}</button>`).join('')}</div>`:''}<div class="card" id="tab"></div>`;
 const reg=can('admin','registrar'),dis=!reg;
 if(tab==='profile')$('#tab').innerHTML=`<div id="pf" class="f">${formOf(PF,ST.s,dis)}</div>${reg?`<p><button onclick="saveProfile()">${id?'Update':'Save'} student</button> <button class="alt" onclick="student(${id?`'${id}'`:'null'})">Reset</button></p>`:''}`;
 if(tab==='enroll'){const gf=[ ['esc','ESC ID'],['qvr','QVR certificate number'],['jhsSf10','JHS SF10'],['lisRem','LIS remarks','area'],['vmsRem','VMS remarks','area'],['vmsStatus','VMS status'],['finalGrade','Final grade','number'],['households','Number of households','number'],['income','Monthly family income','number']];
  const tf=n=>[['cluster','Cluster','opt:clusters'],['section','Section','opt:sections'],['elective','Elective '+n,'opt:electives'],['adviser','Adviser','opt:advisers'],['dateEnrolled','Date enrolled','date'],['status','Enrollment status','sel:'+ENR],['modality','Modality','sel:'+MOD],['lis','LIS remarks','area'],['reason','Reason if not enrolled','area'],['remarks','Enrollment remarks','area']];
  $('#tab').innerHTML=`<div id="gen" class="f"><h3>General enrollment information</h3>${gf.map(([k,l,t])=>fld(k,l,t||'text',(ST.s.gen||{})[k],dis)).join('')}</div>${reg?'<p><button onclick="saveGen()">Save general information</button></p>':''}<p>LRN, name, gender, birthdate and birthplace come from the Profile tab (${esc(full(ST.s))}).</p>`+
  [1,2,3].map(n=>`<div id="t${n}" class="f"><h3>Term ${n} enrollment · ${esc(cur.sy)}</h3>${tf(n).map(([k,l,t])=>fld(k,l,t,ST.e[n][k],dis)).join('')}${reg?`<div><button onclick="saveTerm(${n})">Save Term ${n}</button></div>`:''}</div>`).join('')}
 if(tab==='docs')$('#tab').innerHTML=`<p>Completion: <b>${docPct(ST.d)}</b></p><div id="dc" class="f">${DOCS.map(x=>fld('d_'+x,x,'sel:'+DST,ST.d['d_'+x],dis)).join('')}${fld('dateReceived','Date received','date',ST.d.dateReceived,dis)}${fld('annexRem','Annex E/F remarks','area',ST.d.annexRem,dis)}${fld('adviserRem','Adviser remarks (Annex E/F)','area',ST.d.adviserRem,dis)}${fld('otherRem','Other document remarks','area',ST.d.otherRem,dis)}</div>${reg?'<p><button onclick="saveDocs()">Save checklist</button></p>':''}`;
 if(tab==='prop'){const pd=!can('admin','custodian'),P=ST.p;$('#tab').innerHTML=`<div id="pp" class="f"><h3>School ID</h3>${fld('idNo','School ID number','text',P.idNo,pd)}${fld('idStatus','Status','sel:'+PST,P.idStatus,pd)}${fld('idDate','Date claimed','date',P.idDate,pd)}${fld('idRem','ID remarks','area',P.idRem,pd)}<h3>School uniform</h3>${fld('uniStatus','Status','sel:'+PST,P.uniStatus,pd)}${fld('uniDate','Date claimed','date',P.uniDate,pd)}${fld('uniRem','Remarks','area',P.uniRem,pd)}<h3>P.E. uniform</h3>${fld('peStatus','Status','sel:'+PST,P.peStatus,pd)}${fld('peDate','Date claimed','date',P.peDate,pd)}${fld('peRem','P.E. remarks','area',P.peRem,pd)}</div>${pd?'':'<p><button onclick="saveProp()">Save property record</button></p>'}`}}
function saveProfile(){guard(async()=>{const o=collect($('#pf')),id=ST.id;
 if(!o.lastName||!o.firstName)return toast('Last name and first name are required.',1);
 if(o.email&&!/^\S+@\S+\.\S+$/.test(o.email))return toast('Enter a valid email address.',1);
 for(const k of['contact','ecNo','motherNo','fatherNo'])if(o[k]&&!/^[0-9+\-\s()]{7,15}$/.test(o[k]))return toast('Check the phone number format.',1);
 if(o.lrn){const d=await db.collection('students').where('lrn','==',o.lrn).get();if(d.docs.some(x=>x.id!==id))return toast('Another student already has this LRN.',1)}
 o.lastNameLower=o.lastName.toLowerCase();o.updatedAt=TS();
 if(id){await db.collection('students').doc(id).update(o);log('update student',id);toast('Student updated');student(id)}
 else{o.archived=false;o.createdAt=TS();const r=await db.collection('students').add(o);log('create student',r.id);toast('Student saved');student(r.id)}})}
const sv=(col,id,data,act)=>guard(async()=>{await db.collection(col).doc(id).set({...data,sid:ST.id,updatedAt:TS()},{merge:true});log(act,ST.id);toast('Saved');student(ST.id,ST.tab)});
const saveDocs=()=>sv('registrarDocuments',ST.id,collect($('#dc')),'update documents');
function saveProp(){const o=collect($('#pp')),P=ST.p;const ch=['idStatus','uniStatus','peStatus'].filter(k=>(o[k]||'')!==(P[k]||'')).map(k=>k+': '+(P[k]||'none')+' to '+(o[k]||'none')).join('; ');sv('propertyRecords',ST.id,o,'property '+(ch||'update'))}
function saveGen(){guard(async()=>{await db.collection('students').doc(ST.id).update({gen:collect($('#gen')),updatedAt:TS()});log('update enrollment info',ST.id);toast('Saved')})}
function saveTerm(n){if(Object.keys(ST.e[n]).length&&!confirm('Change the existing Term '+n+' enrollment record?'))return;const o=collect($('#t'+n));
 sv('enrollments',`${ST.id}_${cur.sy}_T${n}`,{...o,sy:cur.sy,term:n},'update term '+n)}
// ---------- reports ----------
const RP={'Master student list':[['LRN',r=>r.s.lrn],['Name',r=>full(r.s)],['Gender',r=>r.s.gender],['Birthdate',r=>r.s.birthdate]],
'Student contact information':[['Name',r=>full(r.s)],['Contact',r=>r.s.contact],['Email',r=>r.s.email],['Emergency contact',r=>[r.s.ecName,r.s.ecNo].filter(Boolean).join(' ')]],
'Enrollment (current term)':[['Name',r=>full(r.s)],['Cluster',r=>r.e?.cluster],['Section',r=>r.e?.section],['Adviser',r=>r.e?.adviser],['Status',r=>r.e?.status]],
'Incomplete documents':[['Name',r=>full(r.s)],['Missing',r=>DOCS.filter(x=>!['Submitted','Verified','Not Required'].includes(r.d?.['d_'+x])).join(', ')]],
'School ID not yet claimed':[['Name',r=>full(r.s)],['ID number',r=>r.p?.idNo],['Status',r=>r.p?.idStatus||'Not Yet Issued']],
'Students not enrolled':[['Name',r=>full(r.s)],['Status',r=>r.e?.status||'No record'],['Reason',r=>r.e?.reason]]};
const RF={'Incomplete documents':r=>DOCS.some(x=>!['Submitted','Verified','Not Required'].includes(r.d?.['d_'+x])),'School ID not yet claimed':r=>!['Claimed','Not Required'].includes(r.p?.idStatus),'Students not enrolled':r=>r.e?.status!=='Enrolled'};
let REP=[];
function reports(){$('#main').innerHTML=`<h2>Reports</h2><div class="row noprint"><select id="rn">${Object.keys(RP).map(x=>`<option>${x}</option>`).join('')}</select><select id="rc2"><option value="">All clusters</option>${names('clusters').map(x=>`<option>${esc(x)}</option>`).join('')}</select><button onclick="runRep()">Generate</button><button class="alt" onclick="csv()">Export CSV</button><button class="alt" onclick="print()">Print</button></div><div id="ro" class="wrap"></div>`}
function runRep(){guard(async()=>{const n=$('#rn').value,cl=$('#rc2').value;$('#ro').textContent='Loading…';
 const s=(await db.collection('students').orderBy('lastNameLower').limit(300).get()).docs.filter(d=>!d.data().archived);
 const g=(c,id)=>db.collection(c).doc(id).get().then(x=>x.data());
 let rows=await Promise.all(s.map(async d=>({s:d.data(),e:await g('enrollments',`${d.id}_${cur.sy}_T${cur.term}`),d:await g('registrarDocuments',d.id),p:await g('propertyRecords',d.id)})));
 if(cl)rows=rows.filter(r=>r.e?.cluster===cl);if(RF[n])rows=rows.filter(RF[n]);
 REP=[RP[n].map(c=>c[0]),...rows.map(r=>RP[n].map(c=>c[1](r)??''))];
 $('#ro').innerHTML=`<h3>${n}</h3><p>${esc(cur.sy)} · Term ${cur.term} · Generated ${new Date().toLocaleDateString()} · ${rows.length} records (first 300 students scanned)</p><table><tr>${REP[0].map(h=>`<th>${h}</th>`).join('')}</tr>${REP.slice(1).map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>`})}
function csv(){if(!REP.length)return toast('Generate a report first.',1);const t=REP.map(r=>r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+t],{type:'text/csv'}));a.download='report.csv';a.click();log('export report','')}
// ---------- settings / users / audit ----------
function settings(){$('#main').innerHTML=`<h2>Settings</h2><div class="card"><h3>Current school year and term</h3><div class="row"><select id="csy">${O.schoolYears.filter(x=>x.active).map(x=>`<option ${x.name===cur.sy?'selected':''}>${esc(x.name)}</option>`).join('')}</select><select id="ctm">${[1,2,3].map(n=>`<option ${n==cur.term?'selected':''}>${n}</option>`).join('')}</select><button onclick="saveCur()">Save</button></div></div>`+
 OPT.map(t=>`<div class="card"><h3>${t}</h3>${O[t].map(x=>`<div class="row"><span style="flex:3">${esc(x.name)} ${x.active?'':'(inactive)'}</span><button class="alt" onclick="tgl('${t}','${x.id}',${!x.active})">${x.active?'Deactivate':'Activate'}</button></div>`).join('')}<div class="row"><input id="a-${t}" placeholder="Add new"><button onclick="addOpt('${t}')">Add</button></div></div>`).join('')}
async function reload(t){O[t]=(await db.collection(t).orderBy('name').get()).docs.map(x=>({id:x.id,...x.data()}));settings()}
const addOpt=t=>guard(async()=>{const v=$('#a-'+t).value.trim();if(!v)return;await db.collection(t).add({name:v,active:true});log('add '+t,v);await reload(t)});
const tgl=(t,id,a)=>guard(async()=>{await db.collection(t).doc(id).update({active:a});log('toggle '+t,id);await reload(t)});
const saveCur=()=>guard(async()=>{cur={sy:$('#csy').value,term:Number($('#ctm').value)};await db.collection('settings').doc('current').set(cur);log('set current term',cur.sy);toast('Saved')});
async function users(){const s=await db.collection('users').get();
 $('#main').innerHTML=`<h2>User management</h2><div class="card"><h3>Create user</h3><div class="f" id="nu">${fld('name','Full name')}${fld('email','Email','email')}${fld('password','Temporary password (6+ characters)','text')}${fld('role','Role','sel:admin,registrar,custodian,viewer')}</div><p><button onclick="mkUser()">Create account</button></p></div><div class="card wrap"><table><tr><th>Name</th><th>Email</th><th>Role</th><th>Active</th><th></th></tr>${s.docs.map(d=>{const u=d.data();return`<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.role)}</td><td>${u.active?'Yes':'No'}</td><td>${d.id===me.uid?'':`<button class="alt" onclick="actUser('${d.id}',${!u.active})">${u.active?'Deactivate':'Activate'}</button>`}</td></tr>`}).join('')}</table></div>`}
const actUser=(id,a)=>guard(async()=>{await db.collection('users').doc(id).update({active:a});log('user active='+a,id);users()});
function mkUser(){guard(async()=>{const o=collect($('#nu'));if(!o.name||!o.email||!o.password||!o.role)return toast('Complete all fields.',1);
 const app2=firebase.apps.find(a=>a.name==='b')||firebase.initializeApp(CFG,'b');
 const c=await app2.auth().createUserWithEmailAndPassword(o.email,o.password);await app2.auth().signOut();
 await db.collection('users').doc(c.user.uid).set({name:o.name,email:o.email,role:o.role,active:true,createdAt:TS()});log('create user',c.user.uid);toast('Account created');users()})}
async function audit(){const s=await db.collection('auditLogs').orderBy('at','desc').limit(60).get();
 $('#main').innerHTML=`<h2>Audit logs</h2><div class="wrap"><table><tr><th>When</th><th>User</th><th>Action</th><th>Record</th></tr>${s.docs.map(d=>{const a=d.data();return`<tr><td>${fmt(a.at)}</td><td>${esc(a.name)}</td><td>${esc(a.action)}</td><td>${esc(a.id)}</td></tr>`}).join('')}</table></div>`}
