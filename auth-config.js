// Konfigurasi login daring aplikasi WASHLY - Simplify the Flow (Firebase Authentication + Firestore).
//
// PENTING: berkas ini dibaca langsung oleh browser. Jangan menambahkan baris "import ...",
// "initializeApp(...)" atau "getAnalytics(...)" dari contoh Firebase; cukup isi nilai di bawah.
// Pisahkan beberapa email admin dengan KOMA. Daftar admin harus sama dengan Firestore → Rules.
window.TIRTAPLAN_AUTH = {
  firebase: {
    apiKey: "AIzaSyCndGEZn1bQY1etP9HuGpMjdweKdwY-t_I",
    authDomain: "washpipe-93f48.firebaseapp.com",
    projectId: "washpipe-93f48",
    messagingSenderId: "1054406683881"
  },
  adminEmails: ["denekijulianto@gmail.com", "eki_julianto@pmi.or.id"],
  // Langganan WASHLY PRO (lihat BILLING.md).
  //  enabled  : true = paket FREE/PRO berlaku. Akun selain admin memakai FREE sampai membeli PRO.
  //  payments : false = pembayaran online belum dibuka (Cloud Functions/Midtrans belum siap); ubah ke true setelah deploy.
  // Tidak ada rahasia di sini: kunci server Midtrans & akses Google Play hanya ada di server (Secret Manager).
  billing: { enabled: true, enforce: true, payments: false, region: "asia-southeast2" },
  // Notifikasi di luar aplikasi (opsional). Kosongkan bila belum dipakai.
  notify: {
    // Push HP/laptop walau aplikasi tertutup lewat aplikasi gratis "ntfy" (ntfy.sh).
    // Isi dengan kata acak yang sulit ditebak (huruf/angka, mis. "washly-7f3k9q2x"); tiap pengguna
    // mendapat topik pribadinya sendiri (lihat ikon lonceng → Notifikasi di aplikasi).
    ntfyTopic: "",
    // Email lewat EmailJS (emailjs.com, gratis 200 email/bulan): Service ID, Template ID, Public Key.
    // Template memakai variabel {{to_email}}, {{to_name}}, {{subject}}, {{message}}, {{link}}.
    emailjs: { serviceId: "", templateId: "", publicKey: "" },
  },
};
