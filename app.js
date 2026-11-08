const {stages, agent, step, demo, matchingJobs} = Workflow;
const $ = id => document.getElementById(id);
const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);
const storageKey = "angkasa-hr-v1";
const seed = {
  candidates: [{
    id:"rina", name:"Rina Pratama", role:"Staf Operasional Tour", stage:"screen",
    criteria:"Mengatur jadwal\nKoordinasi vendor\nMenangani pembatalan mendadak",
    cv:"Dua tahun sebagai event coordinator. Mengatur jadwal acara. Koordinasi vendor transportasi dan katering.",
    results:{}, notes:{}, history:[{text:"Lamaran diterima"}]
  }],
  jobs:[{id:"ops", role:"Staf Operasional Tour", active:true}]
};
let data = structuredClone(seed);
try { const saved = localStorage.getItem(storageKey); if (saved) data = JSON.parse(saved); } catch {}
let selected = data.candidates[0]?.id;
let online = false;
let busy = false;
let submit;

function save(next, message) {
  try { localStorage.setItem(storageKey, JSON.stringify(next)); }
  catch { throw Error("Penyimpanan browser tidak tersedia. Perubahan belum disimpan."); }
  data = next;
  $("notice").textContent = message;
  render();
}

function field(name, label, type="text", value="") {
  const input = type === "textarea"
    ? `<textarea name="${name}" required maxlength="12000">${escape(value)}</textarea>`
    : `<input name="${name}" type="${type}" value="${escape(value)}" required maxlength="140">`;
  return `<label>${label}${input}</label>`;
}
function dialog(title, fields, handler) {
  $("dialog-title").textContent = title;
  $("fields").innerHTML = fields;
  $("error").textContent = "";
  submit = handler;
  $("dialog").showModal();
}
function actionButton(action, label, style="") {
  return `<button type="button" class="${style}" data-action="${action}">${label}</button>`;
}
const primary = (action, label) => actionButton(action, label, "primary");
const reject = () => actionButton("reject", "Tutup proses", "danger");
const results = {
  screen:"AI 1 · Bukti dan celah dari CV", pass:"AI 1 · Pencocokan lowongan", match:"AI 1 · Pencocokan lowongan",
  recheck:"AI 1 · Pencocokan ulang", prepareHR:"AI 2 · Pertanyaan Interview HR",
  evaluateHR:"AI 2 · Evaluasi Interview HR", prepareUser:"AI 2 · Pertanyaan Interview User",
  evaluateUser:"AI 2 · Evaluasi Interview User", accept:"AI 3 · Checklist onboarding"
};

function task(c) {
  const r = c.results;
  switch (c.stage) {
    case "screen": return r.screen
      ? ["Tinjau hasil screening", "Putuskan apakah kandidat lanjut ke psikotes.", primary("advance","Lanjut ke psikotes") + reject()]
      : ["Mulai screening CV", "Agen Screening membandingkan isi CV dengan kriteria posisi.", primary("screen","Jalankan Agen Screening")];
    case "test": return matchingJobs(c, data.jobs).length
      ? ["Catat keputusan psikotes","Posisi tersedia. Jika hasil psikotes dan kualifikasi sesuai, lanjut langsung ke Interview HR.",primary("pass","Lolos · Lanjut ke Interview HR") + reject()]
      : ["Catat keputusan psikotes","Posisi belum tersedia. Jika hasil psikotes dan kualifikasi sesuai, kandidat bisa menunggu di Talent Pool.",primary("pass","Lolos · Masukkan ke Talent Pool") + reject()];
    case "match": return matchingJobs(c, data.jobs).length
      ? ["Tinjau lowongan aktif","Konfirmasi lowongan dan minat kandidat sebelum menjadwalkan Interview HR.",primary("interview","Lanjut ke Interview HR") + actionButton("match","Cek ulang lowongan")]
      : ["Belum ada lowongan yang cocok","Simpan kandidat di Talent Pool untuk diproses ketika posisi dibuka.",primary("pool","Masukkan Talent Pool") + actionButton("match","Cek ulang lowongan")];
    case "pool": return matchingJobs(c, data.jobs).length
      ? ["Posisi sudah tersedia","Konfirmasi minat kandidat untuk melanjutkan ke Interview HR.",primary("interview","Lanjut ke Interview HR")]
      : ["Kandidat di Talent Pool","Kandidat lolos psikotes. Aktifkan posisi saat lowongan tersedia untuk melanjutkan ke Interview HR.",primary("jobs","Kelola lowongan")];
    case "hr": case "user": {
      const suffix = c.stage === "hr" ? "HR" : "User";
      if (!r["prepare"+suffix]) return ["Siapkan pertanyaan wawancara","Agen Wawancara menyiapkan pertanyaan berdasarkan kartu kandidat.",primary("prepare"+suffix,"Buat pertanyaan")];
      if (!r["evaluate"+suffix]) return ["Masukkan catatan wawancara","Simpan jawaban atau contoh yang disampaikan kandidat untuk dievaluasi.",primary("evaluate"+suffix,"Catat & evaluasi jawaban") + reject()];
      return ["Tinjau hasil wawancara","Periksa bukti dan informasi yang masih perlu diklarifikasi.",primary("advance",c.stage === "hr" ? "Lanjut ke Interview User" : "Lanjut ke offering") + actionButton("clarify"+suffix,"Siapkan klarifikasi") + reject()];
    }
    case "offer": return c.offered
      ? ["Catat jawaban kandidat","Onboarding dimulai setelah kandidat menerima penawaran.",primary("accept","Kandidat menerima") + actionButton("decline","Kandidat menolak","danger")]
      : ["Sampaikan penawaran","Catat setelah HR menyampaikan penawaran kepada kandidat.",primary("send","Catat penawaran terkirim")];
    case "onboard": return ["Tinjau checklist onboarding","Tandai selesai setelah tugas onboarding ditangani.",primary("complete","Tandai onboarding selesai")];
    case "done": return ["Onboarding selesai","Checklist tersimpan di kartu kandidat.",""];
    default: return ["Proses ditutup","Riwayat dan catatan keputusan tersedia di kartu kandidat.",""];
  }
}
function render() {
  const query = $("search").value.trim().toLowerCase();
  $("stats").innerHTML = [
    ["Total kandidat", data.candidates.length],
    ["Dalam proses", data.candidates.filter(c=>!["pool","done","closed"].includes(c.stage)).length],
    ["Talent Pool",data.candidates.filter(c=>c.stage==="pool").length],
    ["Onboarding selesai",data.candidates.filter(c=>c.stage==="done").length]
  ].map(([label,value])=>`<div class="stat"><strong>${value}</strong>${label}</div>`).join("");
  $("list").innerHTML = data.candidates.filter(c => (c.name+" "+c.role).toLowerCase().includes(query))
    .map(c=>`<button class="person" data-id="${escape(c.id)}" aria-current="${c.id===selected}">${escape(c.name)}<small>${escape(c.role)} · ${stages[c.stage]}</small></button>`).join("") || '<p class="muted">Tidak ada kandidat.</p>';
  const c = data.candidates.find(c=>c.id===selected);
  if (!c) { $("detail").textContent = "Pilih atau tambahkan kandidat."; return; }
  const [title, description, buttons] = task(c);
  const route = ["screen","test","hr","user","offer","onboard"];
  const waiting = ["pool","match"].includes(c.stage);
  const current = waiting ? "hr" : c.stage;
  const pipeline = route.map((id,index)=>`<li ${!waiting && current===id ? 'aria-current="step"' : c.stage==="done" || index < route.indexOf(current) ? 'class="passed"' : ""}>${index+1}. ${stages[id]}</li>`).join("");
  const output = Object.entries(c.results).reverse().map(([key,value])=>`<div class="result"><h3>${results[key]}</h3><p>${escape(value)}</p></div>`).join("");
  $("detail").innerHTML = `<div class="candidate-head"><div><h2>${escape(c.name)}</h2><p class="muted">${escape(c.role)}</p></div><span class="badge">${stages[c.stage]}</span></div>
    <ol class="pipeline" aria-label="Tahapan rekrutmen">${pipeline}</ol>
    <div class="task"><span class="eyebrow">TINDAKAN BERIKUTNYA</span><h3>${title}</h3><p>${description}</p>${buttons ? '<div class="actions">'+buttons+'</div>' : ''}</div>
    ${output}
    <details><summary>CV dan kriteria posisi</summary><p>${escape(c.cv)}</p><p>${escape(c.criteria)}</p></details>
    <details><summary>Catatan HR dan User</summary>${Object.entries(c.notes).map(([key,note])=>`<p><b>${stages[key]}</b><br>${escape(note)}</p>`).join("") || "<p>Belum ada catatan.</p>"}</details>
    <details><summary>Riwayat aktivitas</summary>${c.history.slice().reverse().map(h=>`<p>${escape(h.text)}</p>`).join("")}</details>`;
}
async function execute(c, action, input={}) {
  if (busy) return;
  busy = true;
  const buttons = [...document.querySelectorAll("#detail button, #form button, #add, #jobs")];
  buttons.forEach(button=>button.disabled=true);
  $("notice").textContent = "Memproses tindakan…";
  try {
    let next;
    if (online) {
      const response = await fetch("/api/action", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({candidate:c,action,input,jobs:data.jobs})});
      const body = await response.json();
      if (!response.ok) throw Error(body.error);
      next = body.candidate;
    } else {
      next = step(c,action,input,data.jobs);
      if (agent[action]) next.results[action] = demo(action,next,data.jobs);
    }
    if (["clarifyHR","clarifyUser"].includes(action)) {
      next.results[action==="clarifyHR" ? "prepareHR" : "prepareUser"] = next.results[action];
      delete next.results[action];
    }
    if (["pass","interview","match"].includes(action)) {
      next.results.match = next.results[action];
      if (action !== "match") delete next.results[action];
    }
    const label = {screen:"Screening ditinjau oleh agen",match:"Lowongan dicek ulang",send:"Penawaran tercatat",prepareHR:"Pertanyaan HR disiapkan",prepareUser:"Pertanyaan User disiapkan",evaluateHR:"Jawaban HR dievaluasi",evaluateUser:"Jawaban teknis dievaluasi",clarifyHR:"Pertanyaan klarifikasi HR disiapkan",clarifyUser:"Pertanyaan klarifikasi User disiapkan"}[action] || "Status → " + stages[next.stage];
    next.history = [...c.history,{text:label}];
    save({...data,candidates:data.candidates.map(item=>item.id===c.id ? next : item)},label);
  } catch (error) {
    $("notice").textContent = error.message;
    throw error;
  } finally {
    busy = false;
    buttons.forEach(button=>button.disabled=false);
  }
}
$("detail").addEventListener("click", async event => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action || busy) return;
  const c = data.candidates.find(candidate=>candidate.id===selected);
  const run = values => execute(c,action,values);
  if (action==="jobs") {
    $("jobs").click();
  } else if (["pass","reject","evaluateHR","evaluateUser","clarifyHR","clarifyUser"].includes(action)) {
    dialog(event.target.textContent,field("note","Catatan atau alasan keputusan","textarea"),run);
  } else if (action==="interview") {
    const jobs = matchingJobs(c, data.jobs);
    if (!jobs.length) { $("notice").textContent = "Belum ada lowongan aktif yang cocok. Masukkan kandidat ke Talent Pool atau aktifkan lowongan."; return; }
    dialog("Konfirmasi Interview HR",`<label>Lowongan aktif<select name="job">${jobs.map(job=>`<option value="${escape(job.id)}">${escape(job.role)}</option>`).join("")}</select></label>`+field("note","Catatan konfirmasi minat kandidat","textarea"),run);
  } else if (action==="accept") {
    dialog("Catat penerimaan penawaran",field("start","Tanggal mulai","date"),run);
  } else {
    try { await run({}); } catch {}
  }
});
$("list").addEventListener("click",event=>{
  const id = event.target.closest("[data-id]")?.dataset.id;
  if (id) {selected=id; render();}
});
$("search").addEventListener("input",render);
$("add").onclick=()=>dialog("Kandidat baru",field("name","Nama kandidat")+field("role","Posisi yang dilamar")+field("criteria","Kriteria posisi (satu per baris)","textarea")+field("cv","Salin teks CV","textarea"),values=>{
  if (Object.values(values).some(value=>!value)) throw Error("Lengkapi semua kolom.");
  const c = {...values,id:crypto.randomUUID(),stage:"screen",results:{},notes:{},history:[{text:"Lamaran diterima"}]};
  selected=c.id;
  $("search").value="";
  save({...data,candidates:[c,...data.candidates]},"Kandidat ditambahkan");
});
$("jobs").onclick=()=>dialog("Kelola lowongan",
  data.jobs.map(job=>`<label><input type="checkbox" style="width:auto;display:inline" name="active-${escape(job.id)}" ${job.active ? "checked" : ""}> ${escape(job.role)} aktif</label>`).join("")+
  '<label>Tambah posisi aktif <input name="role" placeholder="Opsional" maxlength="140"></label>',values=>{
  const jobs=data.jobs.map(job=>({...job,active:!!values["active-"+job.id]}));
  if (values.role) {
    if (jobs.some(job=>job.role.toLowerCase()===values.role.toLowerCase())) throw Error("Posisi sudah ada. Gunakan kotak centang untuk mengaktifkannya.");
    jobs.push({id:crypto.randomUUID(),role:values.role,active:true});
  }
  save({...data,jobs},"Daftar lowongan disimpan");
});
$("form").addEventListener("submit",async event=>{
  event.preventDefault();
  if(busy) return;
  try {
    $("error").textContent="";
    await submit(Object.fromEntries([...new FormData(event.target)].map(([key,value])=>[key,value.trim()])));
    $("dialog").close();
  } catch (error) { $("error").textContent=error.message; }
});
$("close").onclick=$("cancel").onclick=()=>$("dialog").close();
$("dialog").addEventListener("cancel",event=>{if(busy) event.preventDefault();});
render();
if (location.protocol!=="file:") {
  fetch("/api/status").then(r=>r.json()).then(status=>{
    online=status.engine==="langgraph";
    $("mode").textContent=online ? (status.ai ? "LANGGRAPH · AI AKTIF" : "LANGGRAPH · DEMO") : "MODE DEMO";
  }).catch(()=>{});
}
