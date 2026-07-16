// ===== Firebase =====
const firebaseConfig = {
    apiKey: "AIzaSyBo8RHN7GfVk7g8SMISlzzYIkY5KCcrtUg",
    authDomain: "curriculolamic.firebaseapp.com",
    databaseURL: "https://curriculolamic-default-rtdb.firebaseio.com",
    projectId: "curriculolamic",
    storageBucket: "curriculolamic.firebasestorage.app",
    messagingSenderId: "325255911078",
    appId: "1:325255911078:web:126cc8b86537b5fcebc667"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Upload de arquivos via Google Apps Script → Google Drive
const DRIVE_API = "https://script.google.com/macros/s/AKfycbzzqR-O-ViBpkcNtNccer2O-8PlWuFVgKd1MdJEEs94nYEfL25mMyt-fmfpmnNHXurURA/exec";

// Paths do sistema de RH
const PATHS = {
    usuarios: 'rh_usuarios',
    funcionarios: 'rh_funcionarios',
    cargos: 'rh_cargos',
    unidades: 'rh_unidades',
    beneficios: 'rh_beneficios',
    ausencias: 'rh_ausencias',
    asos: 'rh_asos',
    demissoes: 'rh_demissoes',
    treinamentos: 'rh_treinamentos',
    promocoes: 'rh_promocoes',
    transferencias: 'rh_transferencias',
    folha: 'rh_folha',
    bancoHoras: 'rh_banco_horas',
    // Quitação: pagamento de meses específicos DURANTE o ciclo (o ciclo segue correndo com
    // o restante). Fechamento: encerramento do ciclo, só no fim dele ou por desligamento.
    bancoHorasQuitacoes: 'rh_banco_horas_quitacoes',
    bancoHorasFechamentos: 'rh_banco_horas_fechamentos',
    // Hora extra paga direto, fora do banco (feriado a 100%, etc.) — não entra no ciclo,
    // mas soma na folha do mês de referência.
    extraBanco: 'rh_extra_banco',
    parametros: 'rh_parametros',
    imagens: 'rh_imagens'
};

// Helpers de acesso
const DB = {
    async getAll(path) {
        const snap = await db.ref(path).once('value');
        const val = snap.val() || {};
        return Object.entries(val).map(([id, v]) => ({ id, ...v }));
    },
    async getObj(path) {
        const snap = await db.ref(path).once('value');
        return snap.val();
    },
    async save(path, id, data) {
        if (id) { await db.ref(`${path}/${id}`).update(data); return id; }
        const ref = db.ref(path).push();
        await ref.set(data);
        return ref.key;
    },
    async set(path, data) { await db.ref(path).set(data); },
    async remove(path, id) { await db.ref(`${path}/${id}`).remove(); },
    watch(path, cb) { db.ref(path).on('value', snap => cb(snap.val())); }
};
