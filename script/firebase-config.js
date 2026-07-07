// Initialize Firebase
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
const database = firebase.database();

const DRIVE_API = "https://script.google.com/macros/s/AKfycbzzqR-O-ViBpkcNtNccer2O-8PlWuFVgKd1MdJEEs94nYEfL25mMyt-fmfpmnNHXurURA/exec";
const SHEET_API = "https://script.google.com/macros/s/AKfycbwzlnsjXywhXMq1jErG0BiMfMH7Wrv8GQWzwq65xlaxKXEGvPHs5z2WZbXnbio5bDFFlQ/exec";
const MASTER_PWD = "Lamic6530@";

// Firebase paths
const FIREBASE_PATHS = {
    cards: 'curr_colab_cards',
    sheetData: 'curr_colab_sheet_data',
    sheetHash: 'curr_colab_sheet_hash',
    files: 'curr_colab_files'
};

let sheetData = [];      
let cards = [];          
let allFiles = [];       
let deletingCardId = null;
let activeCardId = null;
let modalMode = 'view';  
let isAuthenticated = false;
let pendingAction = null; 
let pendingId = null;

