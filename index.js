const TelegramBot = require('node-telegram-bot-api');
const stringSimilarity = require('string-similarity');
const mysql = require('mysql2/promise');
require('dotenv').config();
const fs = require('fs');
const jsonDataBefore = require('./data.json');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
// Inisialisasi koneksi ke database MySQL
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

var startData = [
    [
        {
            text: 'Skripsi',
            callback_data: 'skripsi',
        },
        {
            text: 'PKL',
            callback_data: 'pkl',
        }
    ]
];

var menuData = [
    [
        {
            text: 'Menu Utama',
            callback_data: 'menu_utama',
        },
        {
            text: 'Selesai',
            callback_data: 'selesai',
        }
    ]
];


function buttonFunc(msg, title, menus) {
    const chatId = msg.chat.id;
    const options = {
        reply_markup: {
            inline_keyboard: menus
        }
    };

    bot.sendMessage(chatId, title, options);
}


async function checkId(chatId, selectedOption) {
    let foundData = false;
    jsonDataBefore.forEach(async (item) => {
        foundData = item.chatId == chatId ? true : false
        foundData == true ? item.message = selectedOption : ""
    });

    if (foundData == false) {
        jsonDataBefore.push({
            chatId: chatId,
            message: selectedOption
        });
    }

    fs.writeFileSync('./data.json', JSON.stringify(jsonDataBefore, null, 2));

}

bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const selectedOption = callbackQuery.data;
    const messageId = callbackQuery.message.message_id;
    let responseText = '';
    if (selectedOption === 'skripsi' || selectedOption === 'pkl') {
        if (selectedOption === 'skripsi') {
            responseText = 'Teman memilih opsi : Skripsi';
        } else if (selectedOption === 'pkl') {
            responseText = 'Teman memilih opsi : Pkl';
        }
        await checkId(chatId, selectedOption)
        await bot.sendMessage(chatId, responseText)
        await bot.sendMessage(chatId, `Untuk melanjutkan permintaan teman, silahkan masukkan judul atau bagan yang ingin teman ketahui : 
        (Contoh: Latar Belakang ${responseText})`);
        await bot.answerCallbackQuery(callbackQuery.id);
    } else {
        if (selectedOption === 'menu_utama') {
            await buttonFunc(callbackQuery.message, "silahkan pilih opsi berikut :", startData)
            await bot.answerCallbackQuery(callbackQuery.id);
        } else if (selectedOption === 'selesai') {
            await bot.sendMessage(chatId, "Senang bisa membantu teman🙏😁")
            await bot.answerCallbackQuery(callbackQuery.id);
        }
    }
});

// Event ketika bot menerima pesan
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userMessage = msg.text.toLowerCase();
    if (userMessage == "/start" || userMessage == "start" || userMessage == "mulai") {
        buttonFunc(msg, "Hallo teman seperjuangan, Saya Chocky asisten pribadi anda. Silahkan pilih opsi yang teman inginkan :", startData)
    } else if (userMessage == "/end" || userMessage == "end") {
        bot.sendMessage(chatId, "Senang bisa membantu teman🙏😁")
    } else {
        if (userMessage == "skripsi") {
            bot.sendMessage(chatId, "ini adalah response dari skripsi")
        } else if (userMessage == "pkl") {
            bot.sendMessage(chatId, "ini adalah response dari pkl")
        } else {
            bot.sendMessage(chatId, "Maaf data tidak ditemukan🙏")
        }
    }
});

console.log("ChatBot sedang berjalan...");
