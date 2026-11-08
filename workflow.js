(function (root) {
  const stages = {
    screen:"Screening CV", test:"Psikotes", match:"Cek lowongan", pool:"Talent Pool",
    hr:"Interview HR", user:"Interview User", offer:"Offering", onboard:"Onboarding",
    done:"Selesai", closed:"Ditutup"
  };
  const transitions = {
    screen:{screen:"screen", advance:"test", reject:"closed"},
    test:{pass:"hr", reject:"closed"},
    match:{match:"match", pool:"pool", interview:"hr"},
    pool:{interview:"hr"},
    hr:{prepareHR:"hr", evaluateHR:"hr", clarifyHR:"hr", advance:"user", reject:"closed"},
    user:{prepareUser:"user", evaluateUser:"user", clarifyUser:"user", advance:"offer", reject:"closed"},
    offer:{send:"offer", accept:"onboard", decline:"closed"},
    onboard:{complete:"done"}, done:{}, closed:{}
  };
  const agent = {
    screen:"screening", pass:"screening", match:"screening", interview:"screening",
    prepareHR:"interview", evaluateHR:"interview", clarifyHR:"interview",
    prepareUser:"interview", evaluateUser:"interview", clarifyUser:"interview", accept:"onboarding"
  };
  const matchingJobs = (candidate, jobs) => jobs.filter(job =>
    job.active && job.role.trim().toLowerCase() === candidate.role.trim().toLowerCase()
  );
  function step(candidate, action, input, jobs) {
    const next = transitions[candidate.stage]?.[action];
    if (!next) throw Error("Tindakan tidak tersedia pada tahap ini.");
    if (["pass","reject","clarifyHR","clarifyUser"].includes(action) && !input.note?.trim()) throw Error("Isi catatan atau alasan HR.");
    if (action === "advance" && !candidate.results[{screen:"screen",hr:"evaluateHR",user:"evaluateUser"}[candidate.stage]]) throw Error("Selesaikan peninjauan tahap ini dulu.");
    if (action === "interview" && !matchingJobs(candidate, jobs).some(job => job.id === input.job)) throw Error("Pilih lowongan aktif yang cocok.");
    if (["evaluateHR","evaluateUser"].includes(action) && (!input.note?.trim() || !candidate.results[action === "evaluateHR" ? "prepareHR" : "prepareUser"])) throw Error("Siapkan pertanyaan dan isi catatan interview.");
    if (["accept","decline"].includes(action) && !candidate.offered) throw Error("Catat pengiriman penawaran dulu.");
    if (action === "accept" && !/^\d{4}-\d{2}-\d{2}$/.test(input.start || "")) throw Error("Isi tanggal mulai.");
    const updated = {...candidate, stage:next, results:{...candidate.results}, notes:{...candidate.notes}};
    if (action === "pass") {
      const [job] = matchingJobs(candidate, jobs);
      if (job) updated.job = job.id;
      else updated.stage = "pool";
    }
    if (input.note) updated.notes[action === "interview" ? "match" : candidate.stage] = input.note;
    if (action === "interview") updated.job = input.job;
    if (action === "send") updated.offered = true;
    if (action === "accept") updated.start = input.start;
    if (action === "clarifyHR") delete updated.results.evaluateHR;
    if (action === "clarifyUser") delete updated.results.evaluateUser;
    return updated;
  }
  function demo(action, candidate, jobs) {
    const open = matchingJobs(candidate, jobs);
    const note = candidate.notes[candidate.stage] || "";
    switch(action) {
      case "screen": {
        const lines = candidate.cv.split(/[\n.!?]+/).map(line => line.trim()).filter(Boolean);
        return candidate.criteria.split("\n").map(line => line.trim()).filter(Boolean).map(criterion => {
          const terms = criterion.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || [];
          const evidence = lines.find(line => terms.length && terms.every(term => line.toLowerCase().includes(term)));
          return criterion + "\n" + (evidence ? "Kutipan untuk ditinjau: “" + evidence + "”" : "Perlu klarifikasi: minta contoh yang menunjukkan " + criterion + ".");
        }).join("\n\n");
      }
      case "pass": case "match": case "interview":
        return open.length ? "Lowongan aktif untuk " + candidate.role + "." : "Belum ada lowongan aktif untuk " + candidate.role + ". Kandidat menunggu di Talent Pool.";
      case "prepareHR": case "clarifyHR":
        return (note ? "Klarifikasi dari HR: " + note + "\n\n" : "") + "Apa situasinya, apa yang Anda lakukan, dan apa hasilnya?\n" +
          (candidate.results.screen?.split("\n").filter(line => line.startsWith("Perlu klarifikasi:")).join("\n") || candidate.criteria);
      case "prepareUser": case "clarifyUser":
        return "Simulasi untuk " + candidate.role + ": rencana berubah mendekati pelaksanaan. Bagaimana Anda menentukan prioritas, menghubungi pihak terkait, dan mengukur hasilnya?" + (candidate.notes.hr ? "\n\nCatatan HR untuk digali: " + candidate.notes.hr : "") + (note ? "\n\nKlarifikasi: " + note : "");
      case "evaluateHR": case "evaluateUser":
        return "Bukti yang dicatat pewawancara:\n“" + note + "”\n\nCek apakah catatan menyebut tindakan kandidat dan hasilnya. Jika salah satunya belum tercatat, minta contoh spesifik sebelum mengambil keputusan.\n\nKriteria posisi:\n" + candidate.criteria;
      case "accept":
        return "Tanggal mulai: " + candidate.start + "\n• HR — Siapkan dokumen dan agenda paling lambat H-3.\n• IT — Siapkan akun dan akses sesuai posisi paling lambat H-2.\n• Atasan — Tetapkan pendamping dan jadwal perkenalan paling lambat H-2.\n• HR — Konfirmasi dokumen, akses, dan jadwal paling lambat H-1.";
      default: throw Error("Aksi agen tidak dikenal.");
    }
  }
  root.Workflow = {stages, transitions, agent, step, demo, matchingJobs};
})(globalThis);
