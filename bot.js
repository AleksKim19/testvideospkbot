const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Замените на ваш токен бота
const BOT_TOKEN = 'YOUR_BOT_TOKEN_HERE';
const WEB_APP_URL = 'https://your-domain.com'; // Замените на ваш домен

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Создаем папку для видео если её нет
if (!fs.existsSync('videos')) {
    fs.mkdirSync('videos');
}

// Хранилище видео (в реальном проекте используйте базу данных)
let videos = [];
let videoIdCounter = 1;

// Загружаем существующие видео при запуске
function loadExistingVideos() {
    const videosPath = path.join(__dirname, 'videos');
    if (fs.existsSync(videosPath)) {
        const files = fs.readdirSync(videosPath);
        files.forEach(file => {
            if (file.endsWith('.mp4') || file.endsWith('.avi') || file.endsWith('.mov')) {
                const videoPath = `/videos/${file}`;
                const existingVideo = videos.find(v => v.url === videoPath);
                if (!existingVideo) {
                    videos.push({
                        id: videoIdCounter++,
                        title: file.replace(/\.[^/.]+$/, ""), // убираем расширение
                        url: videoPath,
                        thumbnail: null,
                        city: 'Не указан',
                        uploadedBy: 'manual'
                    });
                }
            }
        });
    }
}

// Функция для обновления списка видео (вызывается периодически)
function refreshVideoList() {
    const videosPath = path.join(__dirname, 'videos');
    if (fs.existsSync(videosPath)) {
        const files = fs.readdirSync(videosPath);
        const currentFiles = new Set(files.filter(file => 
            file.endsWith('.mp4') || file.endsWith('.avi') || file.endsWith('.mov')
        ));
        
        // Удаляем видео, которых больше нет в папке
        videos = videos.filter(video => {
            const fileName = path.basename(video.url);
            return currentFiles.has(fileName);
        });
        
        // Добавляем новые видео
        currentFiles.forEach(file => {
            const videoPath = `/videos/${file}`;
            const existingVideo = videos.find(v => v.url === videoPath);
            if (!existingVideo) {
                videos.push({
                    id: videoIdCounter++,
                    title: file.replace(/\.[^/.]+$/, ""), // убираем расширение
                    url: videoPath,
                    thumbnail: null,
                    city: 'Не указан',
                    uploadedBy: 'manual'
                });
            }
        });
    }
}

// API endpoints
app.get('/api/videos', (req, res) => {
    const city = req.query.city;
    let filteredVideos = videos;
    
    if (city) {
        filteredVideos = videos.filter(video => 
            video.city.toLowerCase().includes(city.toLowerCase())
        );
    }
    
    res.json(filteredVideos);
});

app.get('/api/video/:id', (req, res) => {
    const videoId = parseInt(req.params.id);
    const video = videos.find(v => v.id === videoId);
    
    if (!video) {
        return res.status(404).json({ error: 'Видео не найдено' });
    }
    
    res.json(video);
});

// Статические файлы для видео
app.use('/videos', express.static('videos'));

// API для обновления списка видео
app.get('/api/refresh', (req, res) => {
    refreshVideoList();
    res.json({ message: 'Список видео обновлен', count: videos.length });
});

// Telegram bot handlers
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userName = msg.from.first_name || 'Пользователь';
    
    const welcomeMessage = `Привет, ${userName}! 👋\n\nДобро пожаловать в бот для просмотра видео!\n\n🎬 Смотрите видео из разных городов\n🏙️ Фильтруйте по городам\n📁 Видео загружаются напрямую в папку на сервере`;
    
    const keyboard = {
        inline_keyboard: [
            [{
                text: '🎬 Открыть видео приложение',
                web_app: { url: WEB_APP_URL }
            }]
        ]
    };
    
    bot.sendMessage(chatId, welcomeMessage, { reply_markup: keyboard });
});

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const helpMessage = `📖 Помощь по боту:\n\n/start - Запустить бот\n/help - Показать эту справку\n/videos - Открыть приложение для просмотра видео\n/refresh - Обновить список видео\n\nВидео загружаются напрямую в папку videos/ на сервере.\nПоддерживаемые форматы: MP4, AVI, MOV`;
    
    bot.sendMessage(chatId, helpMessage);
});

bot.onText(/\/refresh/, (msg) => {
    const chatId = msg.chat.id;
    
    refreshVideoList();
    bot.sendMessage(chatId, `🔄 Список видео обновлен!\n\nНайдено видео: ${videos.length}`);
});

bot.onText(/\/videos/, (msg) => {
    const chatId = msg.chat.id;
    
    const keyboard = {
        inline_keyboard: [[
            {
                text: '🎬 Открыть видео приложение',
                web_app: { url: WEB_APP_URL }
            }
        ]]
    };
    
    bot.sendMessage(chatId, 'Нажмите кнопку для открытия приложения:', { reply_markup: keyboard });
});



// Обработка веб-приложения данных
bot.on('web_app_data', (msg) => {
    const chatId = msg.chat.id;
    const data = JSON.parse(msg.web_app.data);
    
    if (data.action === 'video_played') {
        bot.sendMessage(chatId, `🎬 Вы посмотрели: "${data.videoTitle}" из города ${data.city}`);
    }
});

// Загружаем существующие видео при запуске
loadExistingVideos();

// Автоматическое обновление списка видео каждые 30 секунд
setInterval(() => {
    refreshVideoList();
}, 30000);

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`Веб-приложение доступно по адресу: http://localhost:${PORT}`);
    console.log(`Загружено видео: ${videos.length}`);
    console.log(`Для добавления видео поместите файлы в папку videos/`);
});

console.log('Telegram бот запущен...');