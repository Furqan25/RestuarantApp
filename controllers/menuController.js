const Menu = require('../models/menu');
const {getFirestore } = require("firebase-admin/firestore");

function customError (urlErr) {
    this.urlErr = urlErr;
}

const mainPage = async (req,res) =>{    //renders landing page
    res.render('landing');
}

const menuAll = async (req,res) =>{ 
    try{
        let menus = await Menu.find({}).sort({index:"asc"}); //when you go to main menu page, all items from db should show up. this gets all elemnts inside db
        res.render('menus', {menu: menus});                //renders ejs for main menu page and sends db results
    }
    catch(err){ 
        console.log(err);
    }
}

const menuAllPost = async (req,res) => {
    
    const stripe = require('stripe')(process.env.STRIPE_PRIVATE_KEY);
    let uuid = require('uuid');

    try{
        const incomingData = req.body;

        const incomingItem = incomingData.newItem;
        const incomingUser = req.headers['authorization'] ? req.headers['authorization'].split(" ") : null;

        const item = incomingItem.itemName;
        const itemPrice = incomingItem.itemPrice;
        

        const {getAuth} = require("firebase-admin/auth");
        
        if (!incomingUser){                     
            res.status(400).send("No header provided")
        } 
        else if (!incomingUser[1]) {
            res.status(400).send("No token provided")
        }
        else{
            let decodedToken = await getAuth().verifyIdToken(incomingUser[1])
                
            const uid = decodedToken.uid;
            let menus = await Menu.find({name:item, "itemChoice.price":itemPrice});
            const db = getFirestore();   

            if(menus.length > 0){

                const docRef = await db.collection('Orders').doc(`${uid}`);     
                
                let doc = await docRef.get()
                    
                let menuItemFromDB = doc.data() ? doc.data().menuItem : null ;
                let cartCountFromDB = doc.data() ? Number(doc.data().cartCount) : null
                let fbCKey = doc.data() ? doc.data().cs : null;
                let totalPrice = 0;

                checkItems(incomingItem);
                console.log(incomingItem)

                if(!cartCountFromDB){
                    const paymentIntent = await stripe.paymentIntents.create({
                        amount: `${(incomingItem.itemPrice*100).toFixed(0)}`,
                        currency: "usd",
                        metadata:{
                            fireBaseUID: `${uid}`,
                        },
                        automatic_payment_methods: {
                            enabled: true,
                        },
                    }, {
                        idempotencyKey: uuid.v4()
                    });    

                    const fs_DB = await docRef.set( {
                        menuItem: [incomingItem],
                        cartCount : incomingItem.qty,
                        cs:paymentIntent.id
                        },{merge: true} )
                }
                else{
                    let itemEqualityCaller = checkItemEquality();

                    if(itemEqualityCaller.res){                                
                        const found = itemEqualityCaller.obj; 

                        menuItemFromDB[found].qty = Number(menuItemFromDB[found].qty) + Number(incomingItem.qty);
                        cartCountFromDB= Number(cartCountFromDB) + Number(incomingItem.qty);
                    }
                    else{
                        menuItemFromDB.push(incomingItem);
                        cartCountFromDB= Number(cartCountFromDB) + Number(incomingItem.qty);
                    }
                    
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

                    await docRef.update({ 'menuItem': menuItemFromDB,  cartCount : cartCountFromDB, cs:paymentIntent.id});
                    
                } //if(!cartCountFromDB) <- this things ELSE statement closing bracket


                // just function ________________________________________________________________________________________
                function checkToppingEquality (dbItem) {
                    let isMatch = false

                    function toppingCheck() {
                        return dbItem.Toppings.every(e => {
                            return (incomingItem.Toppings.includes(e)); 

                        })
                    }

                    function sauceCheck(){
                        return dbItem.sauce.every(e => {
                            return (incomingItem.sauce.includes(e)); 
                        
                        })
                    }

                    if(incomingItem.itemName === dbItem.itemName && dbItem.Toppings.length === incomingItem.Toppings.length && dbItem.sauce.length === incomingItem.sauce.length){
                        dbItem.Toppings.sort();
                        incomingItem.Toppings.sort();
                        dbItem.sauce.sort();
                        incomingItem.sauce.sort();

                        if(toppingCheck() && sauceCheck()){
                            isMatch = true;
                        }
                    };
                    
                    return isMatch;
                };  
                //_checkToppingEquality_ ends____________________________________________________________________________


                // just function ____________________________________________________________________________________
                function checkItemEquality (){
                    let result = {
                        res : false,
                        obj : null
                    };
                    
                    result.obj = menuItemFromDB.findIndex(item => {
                        return (incomingItem.itemPrice === item.itemPrice 
                                && incomingItem.Flavor === item.Flavor 
                                && checkToppingEquality(item) 
                                && item.Style === incomingItem.Style 
                                && item.comboDrink === incomingItem.comboDrink 
                                && item.comboSide === incomingItem.comboSide);
                    });

                    if(result.obj !== -1){
                        result.res = true;
                        return result;
                    }

                    return result;  
                }  
                //_checkItemEquality ends__________________________________________________________________________


                res.send({"res": cartCountFromDB});

            } // if(menus.length > 0) closing bracket
            else{
                let customErr = new customError('item doesnt exist boii');
                throw customErr;
            }

        }
    }
    catch(err){
        if (err instanceof customError) {
            console.log(err);
            res.status(400).send({"err":`${err.urlErr}`});
        }
        else{
            console.log(err);
            res.status(400).send({"err":`${err}`});
        }
    }
    
}

function checkItems(it){
    switch(it.Style){
        case ("Regular"):
        case("Wing"):
        case("Side Breast"):
        case("Center Breast"):
        case("Thigh"):
        case("Leg"):
        case("Beef Patty"):
        case("Beef Patty w/cheese"):
        case("Beef Patty w/cheese and pepporoni"):
        case("Side Breast"):{
            if(it.comboDrink || it.comboSide || it.Toppings.legnth>0){
                let customErr = new customError('Stop adding/changing items boii');
                throw customErr;
            }
            else if(it.itemName === "Milkshake" || it.itemName==="Cake" || it.itemName==="Ice Cream"){
                if(!checkFlavor(it.itemName, it.Flavor)){
                    let customErr = new customError('NO CAKES/SHAKES OR ICE CREAM IN THE GREAT DIVIDE');
                    throw customErr;
                }
            }
            break;
        }

        case("Combo"):{
            if(it.Toppings.legnth>0 || !checkDrinks(it) || (!checkSides(it) && it.comboSide) ){
                let customErr = new customError('About to give you the 2 piece combo');
                throw customErr;
            }
            break;
        }

        case("Pizza Slice w/ Topping"):
        case("Small Pie w/ Topping"):
        case("Large Pie w/ Topping"):{
            if(it.comboDrink || it.comboSide || !checkToppings(it) ){
                let customErr = new customError('Y U TOUCH ME PIZZA!');
                throw customErr;
            }
            break;
        }

        case("soda"):
        case("Water"):
        case("Arizona"):
        case("Snapple "):{
            if(it.comboDrink || it.comboSide || it.Toppings.legnth>0 || !checkDrinks(it)){
                let customErr = new customError("For the love of Glob don't touch the soda");
                throw customErr;
            }
            break;
        }
    }
    
    function checkToppings(it){
        let toppings = ['Pepperoni','Corn','Chicken','Veggies','Extra cheese'];
        return it.Toppings.every(e => {
            return (toppings.includes(e)); 
        })
    }
    
    function checkFlavor(name,flavor){
        let icecreamNmilkshake = ['Chocolate' , 'Vanilla', 'Butter Pecan', 'Birthday Cake', 'Cookies N Cream', 'Pistacio'];
        let cake = ['Cheesecake','Strawberry Cheesecake','Chocolate Mousse','Red Velvet','Carrot Cake','Vanilla Iced','Chocolate Cake'];
        if(name === "Cake"){
            return (cake.includes(flavor));
        }
        else{
            return (icecreamNmilkshake.includes(flavor));
        }
    }
    function checkDrinks(it){
        let snapple = ['Apple','Mango','Kiwi Strawberry','Peach Tea','Lemon Tea']
        let arizona = ['Watermelon','Fruit Punch','Mango','Iced Tea','Half & Half','Green Tea']
        let coke = ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape'];
        
        if(it.Style === "Snapple"){
            return (snapple.includes(it.comboDrink));
        }
        else if (it.Style === "Arizona"){
            return (arizona.includes(it.comboDrink));
        }
        else {
            return (coke.includes(it.comboDrink));
        }
    }

    function checkSides(it){
        let sides = ['French Fries', 'Curly Fries (+$1.00)', 'Sweet Potato Fries (+$1.00)', 'Potato Wedges (+$1.00)', 'Onion Rings (+$1.00)', 'Tostones (+$1.00)'];
        let answer = (sides.includes(it.comboSide));
        if (it.comboSide!== "French Fries" && answer){
            it.itemPrice = (Number(it.itemPrice) + 1).toFixed(2);
        }
        return answer;
    }
}

const menuFilter = async (req,res) => { //checks databse to see if any items have a category matching the name specified in the url after url/menu/
    try{
        let name = req.params.name; //gets url param
        let menu = await Menu.find({category: name}).sort({index:"asc"}); //checks databse for match. if found, adds the entire db index to menu as array index
        if(menu.length===0){ // if no match found, throw error that is caught by catch block
            throw ('url dont exist boii')
        }
        res.render('filterMenus', {menu: menu}); //when at least match is found, render ejs file and send it reulsts from db
    }
     //error is caught here. redirect to 404 page, send 404 error
    catch(err) {
        console.log(err);
        res.redirect('/404')
    }
}

const forgotPassword = async (req, res) => {
    res.render('passwordReset')
}

const forgotPasswordSent = async (req, res) => {
    res.render('passwordResetSent')
}

module.exports = {
    mainPage,
    menuAll,
    menuFilter,
    forgotPassword,
    forgotPasswordSent,
    menuAllPost
}

/*
let menu = [ 
    {
        index: 1,
        name: 'Cheeseburger',
        category: ['Burger','Beef'],
        itemChoice: [
            { 
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 4.99,
                description:'Cheeseburger with lettuce, tomato, and pickles'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 6.99,
                description:'Cheeseburger with french fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    {   
        index: 2,
        name: 'Double Cheeseburger',
        category: ['Burger','Beef'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 5.99,
                description:'Cheeseburger with double patties, lettuce, tomato, and pickles'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 7.99,
                description:'Double patty cheeseburger with french fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    {
        index: 3,
        name: 'Bacon Cheesburger',
        category: ['Burger','Beef'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 5.99,
                description:'Cheeseburger with crispy halal turkey bacon'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 7.99,
                description:'Cheeseburger with crispy halal turkey bacon, comes with fries and scan of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    {
        index: 4,
        name: 'Double Bacon Cheeseburger',
        category: ['Burger','Beef'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 6.99,
                description:'Double patty cheeseburger with crispy halal turkey bacon'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 8.99,
                description:'Double patty cheeseburger with crispy halal turkey bacon, comes with fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    {
        index: 5,
        name: 'Italian Cheeseburger',
        category: ['Burger','Beef'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 6.99,
                description:'Cheeseburger with fries inside'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 8.99,
                description:'Cheeseburger with fries inside, comes with can of soda and side order',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape'],
                comboSides:['French Fries', 'Curly Fries (+$1.00)', 'Sweet Potato Fries (+$1.00)', 'Potato Wedges (+$1.00)', 'Onion Rings (+$1.00)', 'Tostones (+$1.00)']
            }
        ]
    },
    {
        index: 6,
        name: 'Chicken Sandwich',
        category: ['Burger','Chicken'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 4.99,
                description:'Crispy chicken patty burger with lettuce and tomato'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 6.99,
                description:'Crispy chicken patty burger with lettuce and tomato, comes with fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    {
        index: 7,
        name: 'Spicy Chicken Sandwich',
        category: ['Burger','Chicken'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 4.99,
                description:'Spicy chicken patty with lettuce and tomato'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 6.99,
                description:'Spicy chicken patty with lettuce and tomato, comes with fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    {
        index: 8,
        name: 'Bacon Chicken Sandwich',
        category: ['Burger'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 5.99,
                description:'Chicken patty with crispy halal turkey bacon'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 7.99,
                description:'Chicken patty with crispy halal turkey bacon, comes with fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    { 
        index: 9,
        name: 'Grilled Chicken Sub',
        category: ['Burger','Chicken'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 6.99,
                description:'Grilled chicken on a hero with lettuce and tomato'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 8.99,
                description:'Grilled chicken on a hero with lettuce and tomato, comes with fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    {
        index: 10,
        name: 'Fish Sandwich',
        category: ['Burger','Seafood'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 4.99,
                description:'Fish sandwich with lettuce and tomato'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 6.99,
                description:'Fish sandwich with lettuce and tomato, comes with fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    {   
        index: 11,
        name: 'Whiting Fish Sub',
        category: ['Burger','Seafood'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 6.99,
                description:'Fresh whiting fish sandwich with lettuce and tomato'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 8.99,
                description:'Fresh whiting fish sandwich with lettuce and tomato, comes with fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    {
        index: 12,
        name: 'Philly Cheesesteak',
        category: ['Burger'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 6.99,
                description:'Philadelphia cheesesteak with peppers and onion on a sub'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 8.99,
                description:'Philadelphia cheesesteak with peppers and onion on a sub, comes with fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    {
        index: 13,
        name: 'Chicken Cheesesteak',
        category: ['Burger'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 6.99,
                description:'Chicken cheesesteak sandwich with peppers and onion on a sub'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 8.99,
                description:'Chicken cheesesteak sandwich with peppers and onion on a sub, comes with fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    {
        index: 14,
        name: 'Lamb Gyro',
        category: ['Other'],
        sauce:['White Sauce','Hot Sauce'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 6.99,
                description:'Fresh lamb gyro (pita roll), comes with salad. Choice of white sauce and hot sauce',
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 8.99,
                description:'Fresh lamb gyro (pita roll), comes with salad and can of soda. Choice of white sauce and hot sauce',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape'],
            }
        ]
    },
    {
        index: 15,
        name: 'Chicken Gyro',
        category: ['Other,Chicken'],
        sauce:['White Sauce','Hot Sauce'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 6.99,
                description: 'Chicken gyro (pita roll), comes with salad. Choice of white sauce and hot sauce',
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 8.99,
                description:'Chicken gyro (pita roll), comes with salad and can of soda. Choice of white sauce and hot sauce',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape'],
            }
        ]
    },
    {
        index: 16,
        name: 'Popcorn Chicken',
        category: ['Other','Chicken'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 5.99,
                description:'Fresh popcorn chicken (small)'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 7.99,
                description:'Fresh popcorn chicken with side of fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    {
        index: 17,
        name: '6pc Mozzerella Sticks',
        category: ['Other','Vegetarian'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 4.99,
                description:'6 piece mozzarella sticks, comes with marinara sauce'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 6.99,
                description:'6 piece mozzarella sticks, comes with marinara sauce, side of fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    {
        index: 18,
        name: 'Chicken Rings',
        category: ['Other','Chicken'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 5.99,
                description:'Fresh chicken rings (small)'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 7.99,
                description:'Fresh chicken rings with side of fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    {
        index: 19,
        name: 'Chicken Strips',
        category: ['Other','Chicken'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 5.99,
                description:'Fresh chicken strips (small)'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 7.99,
                description:'Fresh chicken strips with french fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    {
        index: 20,
        name: '2pc Mix Chicken',
        category: ['Other','Chicken'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 3.99,
                description:'2 piece mixed chicken breast and chicken leg'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 5.99,
                description:'2 piece mixed chicken breast and chicken leg with side of fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
 
    {
        index: 21,
        name: '3pc Mix Chicken',
        category: ['Other','Chicken'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 4.99,
                description:'3 piece mixed chicken of choice'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 6.99,
                description:'3 piece mixed chicken of choice with side of fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    {
        index: 22,
        name: '5pc Mix Chicken',
        category: ['Other','Chicken'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 6.99,
                description:'5 piece mix chicken of choice'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 8.99,
                description:'5 piece mix chicken of choice, comes with side of fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    {
        index: 23,
        name: 'French Fries',
        category: ['Sides','Vegetarian'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 2.00,
                description:'Fresh and hot french fries (small)'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 4.00,
                description:'Fresh and hot french fries (large)'
            }
        ]
    },
    {
        index: 24,
        name: 'Cheese Fries',
        category: ['Sides','Vegetarian'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 3.00,
                description:'Fresh and hot french fries topped with melted cheese (small)'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 5.00,
                description:'Fresh and hot french fries topped with melted cheese (large)'
            }
        ]
    },
    {
        index: 25,
        name: 'Curly Fries',
        category: ['Sides','Vegetarian'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 3.00,
                description:'Crispy curly fries (small)'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 6.00,
                description:'Crispy curly fries (large)'
            }
        ]
    },
    {
        index: 26,
        name: 'Onion Rings',
        category: ['Sides','Vegetarian'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 2.50,
                description:'Fresh onion rings (small)'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 5.00,
                description:'Fresh onion rings (large)'
            }
        ]
    },
    {
        index: 27,
        name: 'Potato Wedges',
        category: ['Sides','Vegetarian'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 3.00,
                description:'Fresh potato wedges (small)'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 5.00,
                description:'Fresh potato wedges (large)'
            }
        ]
    },
    {
        index: 28,
        name: 'Sweet Potato Fries',
        category: ['Sides','Vegetarian'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 3.00,
                description:'Sweet potato fries (small)'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 6.00,
                description:'Sweet potato fries (large)'
            }
        ]
    },
    {
        index: 29,
        name: 'Tostones',
        category: ['Sides','Vegetarian'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 3.00,
                description:'Ripe plantain tostones (small)'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 6.00,
                description:'Ripe plantain tostones (large)'
            }
        ]
    },
    {
        index: 30,
        name: 'Mozzerella Sticks',
        category: ['Sides','Vegetarian'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 5.00,
                description:'Mozzarella sticks (small)'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 8.00,
                description:'Mozzarella sticks (large)'
            }
        ]
    },
    {
        index: 31,
        name: 'Corn on the Cob',
        category: ['Sides','Vegetarian'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 2.50,
                description:'Whole corn on the cob'
            }
        ]
    },
    {
        index: 32,
        name: 'Mash Potato',
        category: ['Sides','Vegetarian'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 2.50,
                description:'Freshly mashed potatoes with gravy (small)'
            }
        ]
    },
    { 
        index: 33,
        name: 'Pizza Roll',
        category: ['Sides','Vegetarian'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 2.50,
                description:'Pizza rolls with fresh marinara (small)'
            }
        ]
    },
    {
        index: 34,
        name: 'Macaroni and Cheese',
        category: ['Sides','Vegetarian'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 2.50,
                description:'Creamy macaroni and cheese '
            }
        ]
    },
    {
        index: 35,
        name: 'Coleslaw',
        category: ['Sides','Vegetarian'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 2.50,
                description:'Fresh coleslaw salad with cabbage and carrots'
            }
        ]
    },
    { 
        index: 36,
        name: 'Macaroni Salad',
        category: ['Sides','Vegetarian'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 2.50,
                description:'Cold macaroni salad (small)'
            }
        ]
    },
    {
        index: 37,
        name: 'Beef Patty',
        category: ['Sides','Beef'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Beef Patty',
                image: 'FUUUCL',
                price: 3.00,
                description:'Beef patties'
            }, 
            {
                nestedIndex: 1,
                name: 'Beef Patty w/cheese',
                image: 'FUUUCL',
                price: 4.00,
                description:'Beef patty with cheese'
            },
            {
                nestedIndex: 2,
                name: 'Beef Patty w/cheese and pepporoni',
                image: 'FUUUCL',
                price: 5.00,
                description:'Beef patty with cheese and pepperoni filling'
            }
        ]
    },
    {
        index: 38,
        name: '6pc Chicken Nuggets',
        category: ['Sides','Chicken'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 3.99,
                description:'6 piece crispy chicken nuggets'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 5.99,
                description:'6 piece crispy chicken nuggets with fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    {
        index: 39,
        name: '9pc Chicken Nuggets',
        category: ['Sides','Chicken'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 6.99,
                description:'9 piece crispy chicken nuggets'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 4.99,
                description:'9 piece crispy chicken nuggets with fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    { 
        index: 40,
        name: '12pc Chicken Nuggets',
        category: ['Sides','Chicken'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 5.99,                    
                description:'12 piece crispy chicken nuggets'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 7.99,                    
                description:'12 piece crispy chicken nuggets with fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    
    },
    { 
        index: 41,
        name: '15pc Chicken Nuggets',
        category: ['Sides','Chicken'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 7.99,
                description:'15 piece crispy chicken nuggets'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 8.99,
                description:'15 piece crispy chicken nuggets with fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    {
        index: 42,
        name: '6pc Hot Wings',
        category: ['Wings','Chicken'],
        flavor: ["Boneless","Bone-In"],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 6.99,
                description:'6 piece hot wings'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 8.99,
                description:'6 piece hot wings with fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    {
        index: 43,
        name: '9pc Hot Wings',
        category: ['Wings','Chicken'],
        flavor: ["Boneless","Bone-In"],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 9.99,
                description:'9 piece hot wings'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 11.99,
                description:'9 piece hot wings with fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    {
        index: 44,
        name: '12pc Hot Wings',
        category: ['Wings','Chicken'],
        flavor: ["Boneless","Bone-In"],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 12.99,
                description:'12 piece hot wings'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 14.99,
                description:'12 piece hot wings with fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    {
        index: 45,
        name: '15pc Hot Wings',
        category: ['Wings','Chicken'],
        flavor: ["Boneless","Bone-In"],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 15.99,
                description:'15 piece hot wings'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 17.99,
                description:'15 piece hot wings with fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    {
        index: 46,
        name: '21pc Hot Wings',
        category: ['Wings','Chicken'],
        flavor: ["Boneless","Bone-In"],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 21.99,
                description:'21 piece hot wings'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 23.99,
                description:'21 piece hot wings with fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    {
        index: 47,
        name: '2pc Chicken Tenders',
        category: ['Wings','Chicken'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 3.99,
                description:'2 piece fresh chicken tenders'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 5.99,
                description:'2 piece fresh chicken tenders with side of fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    {
        index: 48,
        name: '3pc Chicken Tenders',
        category: ['Wings','Chicken'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 4.99,
                description:'3 piece fresh crispy chicken tenders'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 6.99,
                description:'3 piece fresh crispy chicken tenders with side of fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    {
        index: 49,
        name: '5pc Chicken Tenders',
        category: ['Wings','Chicken'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 8.99,
                description:'5 piece fresh crispy chicken tenders'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 9.99,
                description:'5 piece fresh crispy chicken tenders, comes with side of fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    {
        index: 50,
        name: '9pc Chicken Tenders',
        category: ['Wings','Chicken'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 14.99,
                description:'9 piece fresh crispy chicken tenders'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 16.99,
                description:'9 piece fresh crispy chicken tenders, comes with fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    {
        index: 51,
        name: '12pc Chicken Tenders',
        category: ['Wings','Chicken'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 19.99,
                description:' 12 piece fresh crispy chicken tenders'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 21.99,
                description:'12 piece fresh crispy chicken tenders, comes with fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    {
        index: 52,
        name: '2pc Whiting Fish',
        category: ['Seafood'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 5.99,
                description:'2 piece fresh whiting fish'
            }, 
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 8.99,
                description:'2 piece fresh whiting fish, comes with side of fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    {
        index: 53,
        name: '3pc Whiting Fish',
        category: ['Seafood'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 7.99,
                description:'3 piece fresh whiting fish'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 9.99,
                description:'3 piece fresh whiting fish, comes with side of fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    {
        index: 54,
        name: '5pc Whiting Fish',
        category: ['Seafood'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 11.99,
                description:'5 piece fresh whiting fish'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 14.99,
                description:'5 piece fresh whiting fish, comes with fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    {
        index: 55,
        name: '8pc Whiting Fish',
        category: ['Seafood'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 17.99,
                description:'8 piece fresh whiting fish'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 20.99,
                description:'8 piece fresh whiting fish, comes with fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    {   
        index: 56,
        name: '10pc Whiting Fish',
        category: ['Seafood'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 21.99,
                description:'10 piece fresh whiting fish'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 24.99,
                description:'10 piece fresh whiting fish, comes with fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    {
        index: 57,
        name: '6pc Jumbo Shrimp',
        category: ['Seafood'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 4.99,
                description:'6 piece fresh jumbo fried shrimp'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 7.99,
                description:'6 piece fresh jumbo fried shrimp, comes with side of fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    {
        index: 58,
        name: '9pc Jumbo Shrimp',
        category: ['Seafood'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 7.99,
                description:'9 piece fresh jumbo fried shrimp'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 10.99,
                description:'9 piece fresh jumbo fried shrimp, comes with fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    {
        index: 59,
        name: '12pc Jumbo Shrimp',
        category: ['Seafood'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 10.99,
                description:'12 piece fresh jumbo fried shrimp'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 13.99,
                description:'12 piece fresh jumbo fried shrimp with side of fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    {
        index: 60,
        name: '15pc Jumbo Shrimp',
        category: ['Seafood'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 13.99,
                description:'15 piece fresh jumbo fried shrimp'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 16.99,
                description:'15 piece fresh jumbo fried shrimp with side of fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    {
        index: 61,
        name: '21pc Jumbo Shrimp',
        category: ['Seafood'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 4.99,
                description:'21 piece fresh jumbo fried shrimp'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 7.99,
                description:'21 piece fresh jumbo fried shrimp with side of fries and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape']
            }
        ]
    },
    {
        index: 62,
        name: 'Chicken Over Rice',
        category: ['Other'],
        sauce:['White Sauce','Hot Sauce'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 7.99,
                description:'Chicken over rice with choice of white sauce and hot sauce',
            },
        ]
    },
    {
        index: 63,
        name: 'Lamb Over Rice',
        category: ['Other'],
        sauce:['White Sauce','Hot Sauce'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 7.99,
                description:'Lamb over rice with choice of white sauce and hot sauce',
            },
        ]
    },
    {
        
        index: 64,
        name: 'Chicken and Lamb Over Rice',
        category: ['Other'],
        sauce:['White Sauce','Hot Sauce'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 8.99,
                description:'Combination chicken and lamb over rice with choice of white sauce and hot sauce',
            },
        ]
    },
    {
        
        index: 65,
        name: 'Cheese Quesadilla',
        category: ['Other','Vegetarian'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 5.99,
                description:'Fresh cheesy quesadilla'
            },
        ]
    },
    {
        
        index: 66,
        name: 'Chicken Quesadilla',
        category: ['Other','Chicken'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 7.99,
                description:'Chicken quesadilla with melted cheese'
            },
        ]
    },
    {
        
        index: 67,
        name: 'Shrimp Quesadilla',
        category: ['Other','Seafood'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 7.99,
                description:'Shrimp quesadilla with melted cheese'
            },
        ]
    },
    {
        
        index: 68,
        name: 'Steak Quesadilla',
        category: ['Other'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 7.99,
                description:'Steak quesadilla with melted cheese'
            },
        ]
    },
    {
        
        index: 69,
        name: 'Chicken and Steak Quesadilla',
        category: ['Other'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 8.99,
                description:'Combination chicken and steak quesadilla with melted cheese'
            },
        ]
    },
    {
        
        index: 70,
        name: '6pc Mixed Fried Chicken',
        category: ['Fried Chicken','Chicken'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 7.99,
                description:'6 piece crispy mixed chicken'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 9.50,
                description:'6 piece mixed chicken with choice of side and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape'],
                comboSides:['French Fries', 'Curly Fries (+$1.00)', 'Sweet Potato Fries (+$1.00)', 'Potato Wedges (+$1.00)', 'Onion Rings (+$1.00)', 'Tostones (+$1.00)']
            }
        ]
    },
    {
        
        index: 71,
        name: '9pc Mixed Fried Chicken',
        category: ['Fried Chicken','Chicken'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 10.99,
                description:'9 piece mixed chicken'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 14.99,
                description:'9 piece mixed chicken with choice of side and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape'],
                comboSides:['French Fries', 'Curly Fries (+$1.00)', 'Sweet Potato Fries (+$1.00)', 'Potato Wedges (+$1.00)', 'Onion Rings (+$1.00)', 'Tostones (+$1.00)']
            }
        ]
    },
    {
        
        index: 72,
        name: '12pc Mixed Fried Chicken',
        category: ['Fried Chicken','Chicken'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 13.99,
                description:'12 piece mixed chicken'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 16.99,
                description:'12 piece mixed chicken with choice of side and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape'],
                comboSides:['French Fries', 'Curly Fries (+$1.00)', 'Sweet Potato Fries (+$1.00)', 'Potato Wedges (+$1.00)', 'Onion Rings (+$1.00)', 'Tostones (+$1.00)']
            }
        ]
    },
    {
        
        index: 73,
        name: '15pc Mixed Fried Chicken',
        category: ['Fried Chicken','Chicken'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 16.99,
                description:'15 piece mixed chicken'

            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 20.99,
                description:'15 piece mixed chicken with choice of side and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape'],
                comboSides:['French Fries', 'Curly Fries (+$1.00)', 'Sweet Potato Fries (+$1.00)', 'Potato Wedges (+$1.00)', 'Onion Rings (+$1.00)', 'Tostones (+$1.00)']
            }
        ]
    },
    {
        
        index: 74,
        name: '21pc Mixed Fried Chicken',
        category: ['Fried Chicken','Chicken'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 24.99,
                description:'21 piece mixed chicken'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 26.50,
                description:'21 piece mixed chicken with choice of side and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape'],
                comboSides:['French Fries', 'Curly Fries (+$1.00)', 'Sweet Potato Fries (+$1.00)', 'Potato Wedges (+$1.00)', 'Onion Rings (+$1.00)', 'Tostones (+$1.00)']
            }
        ]
    },
    {
        
        index: 75,
        name: '4pc Chicken Wings',
        category: ['Wings','Chicken'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 4.99,
                description:'4 piece chicken wing bucket'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 6.50,
                description:'4 piece chicken wing bucket with choice of side and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape'],
                comboSides:['French Fries', 'Curly Fries (+$1.00)', 'Sweet Potato Fries (+$1.00)', 'Potato Wedges (+$1.00)', 'Onion Rings (+$1.00)', 'Tostones (+$1.00)']
            }
        ]
    },
    {
        
        index: 76,
        name: '6pc Chicken Wings',
        category: ['Wings','Chicken'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 7.50,
                description:'6 piece chicken wing bucket'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 9.00,
                description:'6 piece chicken wing bucket with choice of side and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape'],
                comboSides:['French Fries', 'Curly Fries (+$1.00)', 'Sweet Potato Fries (+$1.00)', 'Potato Wedges (+$1.00)', 'Onion Rings (+$1.00)', 'Tostones (+$1.00)']
            }
        ]
    },
    {
        
        index: 77,
        name: '9pc Chicken Wings',
        category: ['Wings','Chicken'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 11.25,
                description:'9 piece chicken wing bucket'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 12.75,
                description:'9 piece chicken wing bucket with choice of side and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape'],
                comboSides:['French Fries', 'Curly Fries (+$1.00)', 'Sweet Potato Fries (+$1.00)', 'Potato Wedges (+$1.00)', 'Onion Rings (+$1.00)', 'Tostones (+$1.00)']
            }
        ]
    },
    {
        
        index: 78,
        name: '15pc Chicken Wings',
        category: ['Wings','Chicken'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 18.75,
                description:'15 piece chicken wing bucket'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 20.25,
                description:'15 piece chicken wing bucket with choice of side and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape'],
                comboSides:['French Fries', 'Curly Fries (+$1.00)', 'Sweet Potato Fries (+$1.00)', 'Potato Wedges (+$1.00)', 'Onion Rings (+$1.00)', 'Tostones (+$1.00)']
            }
        ]
    },
    {
        
        index: 79,
        name: '20pc Chicken Wings',
        category: ['Wings','Chicken'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 24.99,
                description:'20 piece chicken wing bucket'
            },
            {
                nestedIndex: 1,
                name: 'Combo',
                image: 'FUUUCL',
                price: 26.50,
                description:'20 piece chicken wing bucket with choice of side and can of soda',
                comboDrinks: ['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape'],
                comboSides:['French Fries', 'Curly Fries (+$1.00)', 'Sweet Potato Fries (+$1.00)', 'Potato Wedges (+$1.00)', 'Onion Rings (+$1.00)', 'Tostones (+$1.00)']
            }
        ]
    },
    {
        
        index: 80,
        name: 'Fried Chicken by The Piece',
        category: ['Fried Chicken','Chicken'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Center Breast',
                image: 'FUUUCL',
                price: 2.00,
                description:'Crispy chicken center breast'
            },
            {
                nestedIndex: 1,
                name: 'Side Breast',
                image: 'FUUUCL',
                price: 2.00,
                description:'Crispy chicken side breast'
            },
            {
                nestedIndex: 2,
                name: 'Thigh',
                image: 'FUUUCL',
                price: 1.75,
                description:'Crispy chicken thigh'
            },
            {
                nestedIndex: 3,
                name: 'Leg',
                image: 'FUUUCL',
                price: 1.25,
                description:'Crispy chicken leg'
            },
            {
                nestedIndex: 4,
                name: 'Wing',
                image: 'FUUUCL',
                price: 1.35,
                description:'Crispy chicken wing'
            }
        ]
    },
    {
        
        index: 81,
        name: 'Snack Box',
        category: ['Chicken'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 6.00,
                description:'2pc Chicken, Mash Potatoes, 1 roll'
            },
        ]
    },
    {
        
        index: 82,
        name: 'Dinner Box',
        category: ['Chicken'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 8.00,
                description:'3pc Chicken, Mash Potatoes, Coleslaw, 2 rolls'
            },
        ]
    },
    {
        
        index: 83,
        name: '4pc Box',
        category: ['Chicken'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 9.00,
                description:'4pc Chicken, Mash Potatoes, Coleslaw, 2 Rolls'
            },
        ]
    },
    {
        
        index: 84,
        name: 'Jumbo Box',
        category: ['Chicken'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 10.00,
                description:'5pc Chicken, Mash Potato, Coleslaw, 2 rolls'
            },
        ]
    },
    {
        
        index: 85,
        name: 'Picnic Box',
        category: ['Chicken'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 13.00,
                description:'6pc Chicken, Mash Potato, Coleslaw, 4 rolls'
            },
        ]
    },
    {
        
        index: 86,
        name: 'Value Pack',
        category: ['Chicken'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 17.00,
                description:'9pc Chicken, 2 Mash Potato, 1/2 pint salad, 6 rolls'
            },
        ]
    },
    {
        
        index: 87,
        name: 'Dinner Pack',
        category: ['Chicken'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 27.00,
                description:'15pc Chicken, 4 Mash Potato, 1 pint salad, 8 rolls'
            },
        ]
    },
    {
        
        index: 88,
        name: 'Family Pack',
        category: ['Chicken'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 30.00,
                description:'18pc Chicken, 5 Mash Potato, 2 pint salasd, 10 rolls'
            },
        ]
    },
    {
        
        index: 89,
        name: 'Party Special',
        category: ['Chicken'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 37.00,
                description:'21pc Chicken, 6 Mash Potato, 2 pint salad, 12 rolls'
            },
        ]
    },
    {
        
        index: 90,
        name: 'Garden Salad',
        category: ['Vegetarian','Salad'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 7.99,
                description:'Fresh garden salad with dressing'
            },
        ]
    },
    {
        
        index: 91,
        name: 'Grilled Chicken Salad',
        category: ['Chicken','Salad'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 8.99,
                description:'Fresh garden salad topped with grilled chicken'
            },
        ]
    },
    {
        
        index: 92,
        name: 'Fish Salad',
        category: ['Salad','Seafood'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 8.99,
                description:'Fresh garden salad topped with fish'
            },
        ]
    },
    {
        
        index: 93,
        name: 'Shrimp Salad',
        category: ['Salad','Seafood'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 8.99,
                description:'Fresh garden salad topped with grilled shrimp'
            },
        ]
    },
    {
        
        index: 94,
        name: 'Pizza Slice',
        category: ['Pizza'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Pizza Slice',
                image: 'FUUUCL',
                price: 1.99,
                description:'Slice of pizza'
            },
            {
                nestedIndex: 1,
                name: 'Pizza Slice w/ Topping',
                image: 'FUUUCL',
                price: 3.50,
                customization:['Pepperoni','Corn','Chicken','Veggies','Extra cheese'],
                description:'Slice of pizza with choice of topping: pepperoni, corn, chicken, veggies, or extra cheese'
            },
        ]
    },
    {
        
        index: 95,
        name: 'Small Pizza Pie',
        category: ['Pizza'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Small Pie',
                image: 'FUUUCL',
                price: 6.99,
                description:'Small pizza pie with fresh sauce '
            },
            {
                nestedIndex: 1,
                name: 'Small Pie w/ Topping',
                image: 'FUUUCL',
                price: 9.99,
                customization:['Pepperoni','Corn','Chicken','Veggies','Extra cheese'],
                description: 'Small handmade pizza pie with choice of topping: pepperoni, corn, chicken, veggies, or extra cheese'
            },
        ]
    },
    {
        
        index: 96,
        name: 'Large Pizza Pie',
        category: ['Pizza'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Large Pie',
                image: 'FUUUCL',
                price: 13.99,
                description:'Large handmade pizza pie with fresh sauce '
            },
            {
                nestedIndex: 1,
                name: 'Large Pie w/ Topping',
                image: 'FUUUCL',
                price: 17.99,
                customization:['Pepperoni','Corn','Chicken','Veggies','Extra cheese'],
                description:'Large handmade pizza pie with choice of topping: pepperoni, corn, chicken, veggies, or extra cheese'
            },
        ]
    },
    {
        
        index: 97,
        name: 'Apple Pie',
        category: ['Dessert'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 2.00,
                description:'Small apple pie with cinnamon, served hot'
            },
        ]
    },
    {
        
        index: 98,
        name: 'Sweet Potato Pie',
        category: ['Dessert'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 2.00,
                description:'Small sweet potato pie served hot'
            },
        ]
    },
    {
        
        index: 99,
        name: 'Cake',
        category: ['Dessert'],
        flavor:['Cheesecake','Strawberry Cheesecake','Chocolate Mousse','Red Velvet','Carrot Cake','Vanilla Iced','Chocolate Cake'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 3.99,
                description:'Indulgent cakes'
            },
        ]
    },
    {
        
        index: 100,
        name: 'Ice Cream',
        category: ['Dessert'],
        flavor:['Chocolate' , 'Vanilla', 'Butter Pecan', 'Birthday Cake', 'Cookies N Cream', 'Pistacio'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 3.75,
                description:'Small ice cream'
            },
            {
                nestedIndex: 0,
                name: 'Large',
                image: 'FUUUCL',
                price: 5.75,
                description:'Large ice cream'
            },
        ]
    },
    {
        
        index: 101,
        name: 'Milkshake',
        category: ['Dessert'],
        flavor:['Chocolate' , 'Vanilla', 'Butter Pecan', 'Birthday Cake', 'Cookies N Cream', 'Psistacio'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Regular',
                image: 'FUUUCL',
                price: 5.00,
                description:'Creamy milkshake'
            },
        ]
    },
    {
        
        index: 102,
        name: 'Soda',
        category: ['Drinks'],
        flavor:['Pepsi','Coke','Sprite','Ginger Ale','7up','Orange','Grape'],
        itemChoice:[
            {
                nestedIndex: 0,
                name: 'Soda',
                image: 'FUUUCL',
                price: 1.25,
                description:'Can of soda'
            },
        ]
    },
    {
        
        index: 103,
        name: 'Snapple',
        category: ['Drinks'],
        flavor:['Apple','Mango','Kiwi Strawberry','Peach Tea','Lemon Tea'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Snapple',
                image: 'FUUUCL',
                price: 2.75,
                description:'Bottle of Snapple'
            },
        ]
    },
    {
        
        index: 104,
        name: 'Arizona',
        category: ['Drinks'],
        flavor:['Watermelon','Fruit Punch','Mango','Iced Tea','Half & Half','Green Tea'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Arizona',
                image: 'FUUUCL',
                price: 1.00,
                description:'Can of Arizona'
            },
        ]
    },
    {
        
        index: 105,
        name: 'Water',
        category: ['Drinks'],
        itemChoice: [
            {
                nestedIndex: 0,
                name: 'Water',
                image: 'FUUUCL',
                price: 1.00,
                description:'Bottle of water'
            },
        ]
    }
 
];

*/

/*
Menu.insertMany(menu)
.then((result)=> {
    res.send(result)
    console.log(menu[0].itemChoice[0]);
    console.log(menu[0].itemChoice[0].price);
    console.log(menu[0].itemChoice[1]);
    console.log(menu[0].itemChoice[1].name);
})
.catch((err)=>{
    console.log(err);
});
*/
