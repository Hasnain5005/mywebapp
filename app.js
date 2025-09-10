// Initialize Firebase
const firebaseConfig = {
    apiKey: "AIzaSyB5eo1y81OryaZ-suV_FMpe04_edMIa6Hk",
    authDomain: "mid-rock-coin.firebaseapp.com",
    projectId: "mid-rock-coin",
    storageBucket: "mid-rock-coin.appspot.com",
    messagingSenderId: "911725035840",
    appId: "1:911725035840:web:fe14626d187c11ecb83aa5",
    measurementId: "G-YGPCZ8ZR49"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// DOM Elements
const signUpForm = document.getElementById('signup-form');
const loginForm = document.getElementById('login-form');
const dashboard = document.getElementById('dashboard-container');
const userMessage = document.getElementById('user-message');
const transactionsDiv = document.getElementById('transactions');
const claimBtn = document.getElementById('claim-coin');
const watchAdBtn = document.getElementById('watch-ad');
const swapBtn = document.getElementById('swap-coin');
const logoutBtn = document.getElementById('logout-btn');
const kycBtn = document.getElementById('kyc-submit');

// Show dashboard
function showDashboard(user) {
    signUpForm.parentElement.style.display = 'none';
    loginForm.parentElement.style.display = 'none';
    dashboard.style.display = 'block';
    loadUserData(user.uid);
}

// Load user data
function loadUserData(uid) {
    db.collection('users').doc(uid).get().then(doc => {
        if(doc.exists){
            const data = doc.data();
            document.getElementById('user-info').innerText = `Hello ${data.username || 'User'}`;
            document.getElementById('balance').innerText = `Balance: ${data.balance || 0} Coins`;
            displayTransactions(data.transactions || []);
            setupKYC(data);
        }
    }).catch(err => {
        alert('Error loading user data: ' + err.message);
    });
}

// Display transactions
function displayTransactions(transactions) {
    transactionsDiv.innerHTML = '<h3>Transaction History</h3>';
    transactions.forEach(tx => {
        const p = document.createElement('p');
        p.innerText = `${tx.type} - ${tx.amount} - ${tx.date}`;
        transactionsDiv.appendChild(p);
    });
}

// Setup KYC button
function setupKYC(data){
    if(data.kycRequested && !data.kycFeepaid){
        kycBtn.style.display = 'block';
    } else {
        kycBtn.style.display = 'none';
    }
}

// Sign up
signUpForm.addEventListener('submit', e => {
    e.preventDefault();
    const email = signUpForm['signup-email'].value;
    const password = signUpForm['signup-password'].value;
    const username = signUpForm['signup-username'].value;

    auth.createUserWithEmailAndPassword(email, password)
        .then(cred => {
            return db.collection('users').doc(cred.user.uid).set({
                username: username,
                email: email,
                balance: 0,
                transactions: [],
                role: 'user',
                uid: cred.user.uid,
                permissions: ["claim", "swap", "watchAd"],
                kycRequested: false,
                kycFeepaid: false,
                kycDocuments: [],
                kycStatus: "pending",
                lastClaim: null,
                watchAdCount: 0,
                referralBonus: 0,
                referralCode: generateReferralCode(),
                referredBy: ""
            });
        })
        .then(() => { userMessage.innerText = 'Account created successfully!'; })
        .catch(err => { userMessage.innerText = err.message; });
});

// Log in
loginForm.addEventListener('submit', e => {
    e.preventDefault();
    const email = loginForm['login-email'].value;
    const password = loginForm['login-password'].value;

    auth.signInWithEmailAndPassword(email, password)
        .then(cred => { showDashboard(cred.user); })
        .catch(err => { userMessage.innerText = err.message; });
});

// Logout
logoutBtn.addEventListener('click', () => {
    auth.signOut().then(() => {
        dashboard.style.display = 'none';
        signUpForm.parentElement.style.display = 'block';
        loginForm.parentElement.style.display = 'block';
    });
});

// Claim coins
claimBtn.addEventListener('click', () => {
    const user = auth.currentUser;
    if(!user) return;

    db.collection('users').doc(user.uid).get().then(doc => {
        const data = doc.data();
        const lastClaim = data.lastClaim ? new Date(data.lastClaim.toDate()) : null;
        const now = new Date();
        const oneWeek = 7*24*60*60*1000;

        if(!lastClaim || now - lastClaim >= oneWeek){
            const newBalance = (data.balance || 0) + 2;
            const newTx = {type:'Claim', amount:2, date: now.toLocaleString()};
            db.collection('users').doc(user.uid).update({
                balance: newBalance,
                lastClaim: firebase.firestore.Timestamp.fromDate(now),
                transactions: firebase.firestore.FieldValue.arrayUnion(newTx)
            }).then(()=>loadUserData(user.uid));
        } else {
            alert('You can claim once per week only!');
        }
    });
});

// Watch Ad
watchAdBtn.addEventListener('click', () => {
    const user = auth.currentUser;
    if(!user) return;

    const points = Math.floor(Math.random()*100)+1;
    db.collection('users').doc(user.uid).get().then(doc => {
        const data = doc.data();
        const coinsEarned = Math.floor(points/500)*2;
        const newBalance = (data.balance || 0) + coinsEarned;
        const newTx = {type:'Ad Watching', amount:coinsEarned, date:new Date().toLocaleString()};
        db.collection('users').doc(user.uid).update({
            balance: newBalance,
            transactions: firebase.firestore.FieldValue.arrayUnion(newTx)
        }).then(()=>loadUserData(user.uid));
    });
});

// Swap coins
swapBtn.addEventListener('click', () => {
    const user = auth.currentUser;
    if(!user) return;

    const amount = parseInt(prompt("Enter coins to convert to PKR (1 coin = 1 PKR):"));
    if(isNaN(amount) || amount <=0){ alert("Invalid amount"); return; }

    db.collection('users').doc(user.uid).get().then(doc => {
        const data = doc.data();
        if((data.balance || 0)<amount){ alert("Insufficient balance"); return; }

        const newBalance = data.balance - amount;
        const newTx = {type:'Swap', amount:amount, date:new Date().toLocaleString()};
        db.collection('users').doc(user.uid).update({
            balance: newBalance,
            transactions: firebase.firestore.FieldValue.arrayUnion(newTx)
        }).then(()=>loadUserData(user.uid));
    });
});

// KYC Submit
kycBtn.addEventListener('click', () => {
    const user = auth.currentUser;
    if(!user) return;

    db.collection('users').doc(user.uid).update({
        kycFeepaid: true,
        kycRequested: true
    }).then(()=> alert("KYC Fee Paid, Request Sent to Admin"));
});

// Generate Referral Code
function generateReferralCode(){
    return Math.random().toString(36).substr(2,8).toUpperCase();
}

// Auth state listener
auth.onAuthStateChanged(user => {
    if(user) showDashboard(user);
    else{
        dashboard.style.display = 'none';
        signUpForm.parentElement.style.display = 'block';
        loginForm.parentElement.style.display = 'block';
    }
});
