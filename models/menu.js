const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/*
const comboAddOns = new Schema({
    nestedIndex: {
        type: Number,
        required: true
    },
    name:{
        type: String,
        required: true
    },
})
*/
const nestedItems = new Schema({
    nestedIndex: { 
        type: Number, 
        required: true 
    },
    name:{
        type: String,
        required: true
    },
    image: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    customization: {
        type: [String],
        required: false
    },
    description: {
        type: String,
        required: true
    },
    comboDrinks: {
        type: [String],
        required: false
    },
    comboSides: {
        type: [String],
        required: false
    }
})

const menuSchema = new Schema({
    index: { 
        type: Number, 
        required: true 
    },
    name: { 
        type: String, 
        required: true 
    },
    category: {
        type: [String],
        required: true
    },
    sauce:{
        type: [String],
        required: false
    },
    flavor: {
        type: [String],
        required: false
    },
    itemChoice:{
        type:[nestedItems], 
        required: true
    }

}, {timestamps: true});

const Menu = mongoose.model('menus', menuSchema);
module.exports = Menu;