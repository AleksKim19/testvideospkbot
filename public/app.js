// Инициализация Telegram WebApp
let tg = window.Telegram.WebApp;
tg.expand();

// Глобальные переменные
let allVideos = [];
let currentVideo = null;

// Элементы DOM
const videoGrid = document.getElementById('videoGrid');
const loading = document.getElementById('loading');
const videoPlayer = document.getElementById('videoPlayer');
const mainVideo = document.getElementById('mainVideo');
const videoSource = document.getElementById('videoSource');
const videoTitle = document.getElementById('videoTitle');
const cityFilter = document.getElementById('cityFilter');

// Загрузка видео при старте
document.addEventListener('DOMContentLoaded', () => {
    loadVideos();
    
    // Настройка Telegram WebApp
    tg.ready();
    tg.MainButton.setText('Закрыть приложение');
    tg.MainButton.onClick(() => {
        tg.close();
    });
});

// Загрузка списка видео
async function loadVideos(city = '') {
    try {
        loading.style.display = 'block';
        videoGrid.innerHTML = '';
        
        const url = city ? `/api/videos?city=${encodeURIComponent(city)}` : '/api/videos';
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('Ошибка загрузки видео');
        }
        
        allVideos = await response.json();
        displayVideos(allVideos);
        
    } catch (error) {
        console.error('Ошибка:', error);
        videoGrid.innerHTML = '<div class="error">Ошибка загрузки видео. Попробуйте позже.</div>';
    } finally {
        loading.style.display = 'none';
    }
}

// Отображение видео в сетке
function displayVideos(videos) {
    if (videos.length === 0) {
        videoGrid.innerHTML = '<div class="error">Видео не найдены</div>';
        return;
    }
    
    videoGrid.innerHTML = videos.map(video => {
        return `
            <div class="video-card" onclick="playVideo(${video.id})">
                <div class="video-thumbnail">
                    🎬
                </div>
                <div class="video-info">
                    <div class="video-title">${escapeHtml(video.title)}</div>
                    <div class="video-city">${escapeHtml(video.city)}</div>
                </div>
            </div>
        `;
    }).join('');
}

// Воспроизведение видео
async function playVideo(videoId) {
    try {
        const response = await fetch(`/api/video/${videoId}`);
        
        if (!response.ok) {
            throw new Error('Видео не найдено');
        }
        
        currentVideo = await response.json();
        
        // Обновляем источник видео
        videoSource.src = currentVideo.url;
        videoTitle.textContent = currentVideo.title;
        
        // Показываем плеер
        videoPlayer.classList.remove('hidden');
        mainVideo.load();
        
        // Отправляем данные в Telegram
        if (tg.initDataUnsafe?.user) {
            tg.sendData(JSON.stringify({
                action: 'video_played',
                videoId: videoId,
                videoTitle: currentVideo.title,
                city: currentVideo.city,
                userId: tg.initDataUnsafe.user.id
            }));
        }
        
        // Скрываем главную кнопку во время просмотра
        tg.MainButton.hide();
        
    } catch (error) {
        console.error('Ошибка воспроизведения:', error);
        alert('Ошибка воспроизведения видео');
    }
}

// Закрытие плеера
function closePlayer() {
    videoPlayer.classList.add('hidden');
    mainVideo.pause();
    currentVideo = null;
    
    // Показываем главную кнопку обратно
    tg.MainButton.show();
}

// Фильтрация видео по городу
function filterVideos() {
    const city = cityFilter.value.trim();
    loadVideos(city);
}

// Обработка Enter в поле поиска
cityFilter.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        filterVideos();
    }
});

// Обработка событий видео
mainVideo.addEventListener('loadstart', () => {
    console.log('Начало загрузки видео');
});

mainVideo.addEventListener('canplay', () => {
    console.log('Видео готово к воспроизведению');
});

mainVideo.addEventListener('error', (e) => {
    console.error('Ошибка видео:', e);
    alert('Ошибка загрузки видео');
    closePlayer();
});

// Закрытие плеера по ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !videoPlayer.classList.contains('hidden')) {
        closePlayer();
    }
});

// Обработка изменения ориентации
window.addEventListener('orientationchange', () => {
    setTimeout(() => {
        if (!videoPlayer.classList.contains('hidden')) {
            mainVideo.style.height = 'calc(100vh - 70px)';
        }
    }, 100);
});

// Утилиты
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Обработка состояния приложения
tg.onEvent('viewportChanged', () => {
    console.log('Viewport изменен:', tg.viewportHeight);
});

// Показать главную кнопку при загрузке
tg.MainButton.show();