const express = require("express");
const exp = express();
const compression = require('compression')
const cors = require('cors');
const mongoose = require('mongoose');
const { initializeApp } = require("firebase/app");
const admin = require("firebase-admin");
const {getFirestore } = require("firebase-admin/firestore");
const menuController = require('./controllers/menuController');
require('dotenv').config();

//-----------firebase configurations----------------//
const firebaseConfig = {
    apiKey: process.env.API_KEY,
    authDomain: process.env.AUTH_DOMAIN,
    projectId: process.env.PROJECT_ID,
    storageBucket: process.env.STORAGE_BUCKET,
    messagingSenderId: process.env.MESSAGING_SENDER_ID,
    appId: process.env.APP_ID
};

const app = initializeApp(firebaseConfig);

const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.DATABASE_URL
});
//const db = admin.getFirestore();  
const db = getFirestore();  
//-------------------------------------------------//


//-----------MongoDB configurations----------------//
const dbURI = process.env.MONGO;

mongoose.connect(dbURI, {useNewUrlParser: true, useUnifiedTopology: true})
.then((result)=> exp.listen(process.env.PORT))
.catch((err)=> console.log(err));
//-------------------------------------------------//


//-----------CORES and URLENCODED----------------//
const corstOptions = {
    origin:'https://697a-2607-fb90-fed0-f52d-9d45-b5ee-bc64-a90b.ngrok.io',
    optionsSuccessStatus: 200
};
exp.use(cors(corstOptions));
exp.use(express.urlencoded({ extended: true }));
//-------------------------------------------------//


//-----------*** stripe Webhook must be done before express.json() *** ----------------//
exp.post('/webhook', express.raw({type: 'application/json'}), async(req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_ENDPOINT_SEC;

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        switch (event.type) {
            case 'payment_intent.payment_failed':{
                const paymentIntent = event.data.object;
                const error = paymentIntent.last_payment_error;

                switch (error.type) {
                    case 'card_error':
                        console.log(`A payment error occurred: ${error.message}`);
                        break;
                    case 'invalid_request':
                        console.log('An invalid request occurred.');
                        if (error.param) {
                            console.log(`The parameter ${error.param} is invalid or missing.`);
                        }
                        break;
                    default:
                        console.log('Another problem occurred, maybe unrelated to Stripe.');
                        break;
                
                }
                break;
            }
            case 'payment_intent.succeeded':{
                const paymentIntent = event.data.object;
                const db = getFirestore();  
                const docRef = await db.collection('confirmedOrders').doc('confirmedOrdersList').collection('unfinishedOrders').doc(`${event.data.object.id}`);   
                const docRefItemsOrdered = await db.collection('Orders').doc(`${paymentIntent.metadata.fireBaseUID}`);

                let doc = await docRefItemsOrdered.get();
                        
                let menuItemFromDB = doc.data().menuItem;

                await docRef.set({
                    orderInfo: {
                        ItemsOrdered: menuItemFromDB, 
                        //maybe change this to a order # ^^^^^^^^^^^ using date/time and something else. max 4-5 characters
                        OrderType: 'delivery or pickup',
                        deliveryAddress: 'if delivery add address otherwise N/A'
                    },
                    userInfo: {
                        userID: paymentIntent.metadata.fireBaseUID, 
                        userEmail: 'email',
                        userName: 'userName'
                    } 
                });

                await db.collection('Orders').doc(`${paymentIntent.metadata.fireBaseUID}`).delete().then(() => {
                    console.log("Goodbye Doc");
                });

                break;
            }
            default:
                console.log(`Unhandled event type ${event.type}`);
        }
    
    }
    catch (err) {
        console.log(err)
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }
      // Return a 200 response to acknowledge receipt of the event
    res.send();


})  
//-----------------------------------------------------------------------------------//


//----------------MIDDLWARE ----------------//
exp.use(express.json());
exp.disable('x-powered-by');
exp.use(compression()); 
exp.set('view engine','ejs');
exp.use(express.static('public')); //for css
exp.use(express.static('views')); //for js containing event listers
//-----------------------------------------//


//---------------Stripe Configurations (not needed for webhooks) --------------------//
const stripe = require('stripe')(process.env.STRIPE_PRIVATE_KEY);
let uuid = require('uuid');
//----------------------------------------------------------------------------------//


//---------------GET landing/menu/menu:filter AND post order to firebase--------------//
exp.get('/', menuController.mainPage); //main page

exp.get('/dingus', async (req,res)=>{
    const db = getFirestore();  

    //const docRef = await db.collection('confirmedOrders').doc('confirmedOrdersList').collection('unfinishedOrders').doc('N5FJhev4cbL7fEq2LuOp');   
    
    //await docRef.set({ 'menuItem': 5,  cartCount :6, cs:7});
/*
    let dick = await docRef.get();
    dick.forEach(balls=>{
        console.log(balls)
    })
*/

    /*
const docRef = await db.collection('confirmedOrders').doc('confirmedOrdersList').collection('unfinishedOrders').doc('N5FJhev4cbL7fEq2LuOp');     
    docRef.get().then(async (doc)=>{
        console.log(doc.data())
    })
    .catch((error) => {
        console.log(error);
    });

    */
    //await docRef.update({ 'menuItem': menuItemFromDB,  cartCount : cartCountFromDB, cs:paymentIntent.id});

})

exp.get('/menu',  menuController.menuAll); //menu page with all items. no filters
exp.post('/menu', menuController.menuAllPost);

exp.get('/menu/:name',  menuController.menuFilter); //when filter link is clicked, redirects to different url containing filtered items. adds name of filter to end of url
//----------------------------------------------------------------------------------//


//-------------- GET checkout page \ GET order from firebase \ DELETE order in firebase------------------//
exp.get("/checkout", (req,res) => {
    res.render("checkout.ejs");
})

exp.get('/order', async (req,res) => {
    try{      
        let incomingUser = req.headers['authorization'] ? req.headers['authorization'].split(" ") : null;
        const {getAuth} = require("firebase-admin/auth");

        if (!incomingUser){
            res.status(400).send("No header provided")
        } 
        else if (!incomingUser[1]) {
            res.status(400).send("No token provided")
        }
        else{
            const decodedToken = await getAuth().verifyIdToken(incomingUser[1]);
            const uid = decodedToken.uid;
            const db = getFirestore();  
            const docRef = await db.collection('Orders').doc(`${uid}`);
                
            let doc = await docRef.get();
                    
            let menuItemFromDB = doc.data() ? doc.data().menuItem : null ;
            let cartCountFromDB = doc.data() ? Number(doc.data().cartCount) : null;
            let fbCKey = doc.data() ? doc.data().cs : null;
            let totalPrice = 0;
            if(menuItemFromDB && menuItemFromDB.length>0){
                menuItemFromDB.forEach(element => totalPrice += Number((element.itemPrice*element.qty).toFixed(2)));

                const paymentIntent = await stripe.paymentIntents.update(
                    `${fbCKey}`,
                    {
                        amount: `${(totalPrice*100).toFixed(0)}`,
                        metadata:{
                            fireBaseUID: `${uid}`,
                        }
                    }
                );
                res.send({menuItemFromDB:menuItemFromDB, total:totalPrice.toFixed(2), cs: paymentIntent.client_secret})

            }
            else{
                res.send({menuItemFromDB:menuItemFromDB, total:totalPrice.toFixed(2)})
            }
        }
    }
    catch(err){
        res.status(401).send(err);
    }
})

exp.delete('/checkout', async (req,res) => {
    try{
        let incomingUser = req.headers['authorization'] ? req.headers['authorization'].split(" ") : null;
        const {getAuth} = require("firebase-admin/auth");

        if (!incomingUser){
            res.status(400).send("No header provided")
        } 
        else if (!incomingUser[1]) {
            res.status(400).send("No token provided")
        }
        else{
            const decodedToken = await getAuth().verifyIdToken(incomingUser[1]);
            const uid = decodedToken.uid;
            const db = getFirestore();  
            const docRef = await db.collection('Orders').doc(`${uid}`);     
                    
            let doc = await docRef.get();
                
            let menuItemFromDB = doc.data() ? doc.data().menuItem : null ;
            let cartCountFromDB = doc.data() ? Number(doc.data().cartCount) : null

            if(!cartCountFromDB){
                res.end();
            }
            else{
                cartCountFromDB -= menuItemFromDB[req.body.num].qty
                menuItemFromDB.splice(req.body.num,1);
                await docRef.update({ 'menuItem': menuItemFromDB,  cartCount : cartCountFromDB});
                res.send({dingus:6})
            }
        }
        
    }
    catch(err){
        res.status(401).send(err);
    }
})
//------------------------------------------------------------------------------------------------------//


//-----------GET signup and Password pages----------------//
exp.get('/forgotPassword', menuController.forgotPassword);

exp.get('/forgotPasswordSent', menuController.forgotPasswordSent);

exp.get('/orderConfirmation', (req, res) => {
    res.render('orderConfirm.ejs');
});
//----------------------------------------------------//


exp.use((req, res)=>{ //fires if any url that doesnt exist is entered
    res.status(404).render('404');
})
//exp.listen(process.env.PORT, () => console.log(`Server running in port ${process.env.PORT}`));