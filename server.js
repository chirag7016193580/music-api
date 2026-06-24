const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());

app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.song;

        if (!query) {
            return res.json([]);
        }

        // Working JioSaavn API
        const apiUrl = `https://saavn.dev/api/search/songs?query=${encodeURIComponent(query)}`;

        console.log("🔎 Searching:", query);

        const response = await axios.get(apiUrl);

        const songs = response.data.data.results.map(song => ({
            title: song.name,
            artist: song.artists.primary[0]?.name || "Unknown",
            image: song.image[2]?.url || "",
            audioUrl: song.downloadUrl[4]?.url || ""
        }));

        res.json(songs);

    } catch (err) {
        console.error("❌ Error:", err.message);

        res.status(500).json({
            error: "Music API failed"
        });
    }
});

const PORT = 3000;

app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const path = require('path');
const app = express();
app.use(cors());
// Serve static files (index.html, etc.)
app.use(express.static(path.join(__dirname)));
// ============================================================
// JioSaavn Encrypted URL Decryption
// Key: 38346591, Algorithm: DES-ECB
// ============================================================
const JIOSAAVN_DES_KEY = '38346591';
function decryptMediaUrl(encryptedBase64) {
    try {
        const decipher = crypto.createDecipheriv('des-ecb', JIOSAAVN_DES_KEY, null);
        decipher.setAutoPadding(true);
        let decrypted = decipher.update(encryptedBase64, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (err) {
        console.error('Decryption failed:', err.message);
        return '';
    }
}
// Get full quality download URL from decrypted base URL
function getFullQualityUrl(decryptedUrl, has320kbps) {
    if (!decryptedUrl) return '';
    // Decrypted URL comes as _96.mp4, we upgrade to 320 or 160
    if (has320kbps) {
        return decryptedUrl.replace('_96.mp4', '_320.mp4');
    }
    return decryptedUrl.replace('_96.mp4', '_160.mp4');
}
// ============================================================
// HTML Entity Decoder
// ============================================================
function decodeHTMLEntities(str) {
    if (!str) return '';
    return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&nbsp;/g, ' ');
}
// ============================================================
// JioSaavn API Base URL
// ============================================================
const JIOSAAVN_API = 'https://www.jiosaavn.com/api.php';
const JIOSAAVN_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'hi-IN,hi;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cookie': 'L=hindi',
    'Referer': 'https://www.jiosaavn.com/'
};
// ============================================================
// SEARCH METHOD 1: Autocomplete → Song Details (Most Reliable)
// ============================================================
async function searchViaSongDetails(query) {
    try {
        // Step 1: Get song IDs via autocomplete
        const autoRes = await axios.get(JIOSAAVN_API, {
            params: {
                __call: 'autocomplete.get',
                _format: 'json',
                _marker: '0',
                ctx: 'web6dot0',
                query: query
            },
            headers: JIOSAAVN_HEADERS,
            timeout: 10000
        });
        const autoData = autoRes.data;
        if (!autoData || !autoData.songs || !autoData.songs.data || autoData.songs.data.length === 0) {
            return [];
        }
        // Step 2: Get full details with encrypted_media_url
        const songIds = autoData.songs.data.map(s => s.id).slice(0, 15);
        const pids = songIds.join(',');
        const detailRes = await axios.get(JIOSAAVN_API, {
            params: {
                __call: 'song.getDetails',
                _format: 'json',
                _marker: '0',
                ctx: 'web6dot0',
                pids: pids
            },
            headers: JIOSAAVN_HEADERS,
            timeout: 10000
        });
        const detailData = detailRes.data;
        if (!detailData || !detailData.songs || detailData.songs.length === 0) return [];
        // Step 3: Decrypt each song's media URL
        const songs = [];
        for (const song of detailData.songs) {
            if (!song.encrypted_media_url) continue;
            const decryptedUrl = decryptMediaUrl(song.encrypted_media_url);
            if (!decryptedUrl) continue;
            const has320 = song['320kbps'] === 'true';
            const audioUrl = getFullQualityUrl(decryptedUrl, has320);
            if (!audioUrl) continue;
            songs.push({
                title: decodeHTMLEntities(song.song || song.title || ''),
                artist: decodeHTMLEntities(song.primary_artists || song.singers || 'Unknown'),
                image: (song.image || '').replace('150x150', '500x500').replace('50x50', '500x500'),
                audioUrl: audioUrl,
                duration: song.duration || '',
                album: decodeHTMLEntities(song.album || ''),
                year: song.year || '',
                quality: has320 ? '320kbps' : '160kbps',
                language: song.language || ''
            });
        }
        return songs;
    } catch (err) {
        console.error('❌ Song Details search failed:', err.message);
        return [];
    }
}
// ============================================================
// SEARCH METHOD 2: Direct search.getResults + Decrypt
// ============================================================
async function searchViaGetResults(query) {
    try {
        const response = await axios.get(JIOSAAVN_API, {
            params: {
                __call: 'search.getResults',
                _format: 'json',
                _marker: '0',
                api_version: '4',
                ctx: 'web6dot0',
                n: '20',
                q: query
            },
            headers: JIOSAAVN_HEADERS,
            timeout: 10000
        });
        const data = response.data;
        if (!data || !data.results || data.results.length === 0) return [];
        const songs = [];
        for (const song of data.results) {
            const encUrl = song.more_info?.encrypted_media_url;
            if (!encUrl) continue;
            const decryptedUrl = decryptMediaUrl(encUrl);
            if (!decryptedUrl) continue;
            const has320 = song.more_info?.['320kbps'] === 'true';
            const audioUrl = getFullQualityUrl(decryptedUrl, has320);
            if (!audioUrl) continue;
            songs.push({
                title: decodeHTMLEntities(song.title || song.song || ''),
                artist: decodeHTMLEntities(
                    song.more_info?.artistMap?.primary_artists?.[0]?.name ||
                    song.more_info?.primary_artists ||
                    'Unknown'
                ),
                image: (song.image || '').replace('150x150', '500x500').replace('50x50', '500x500'),
                audioUrl: audioUrl,
                duration: song.more_info?.duration || '',
                album: decodeHTMLEntities(song.more_info?.album || ''),
                year: song.year || '',
                quality: has320 ? '320kbps' : '160kbps',
                language: song.language || ''
            });
        }
        return songs;
    } catch (err) {
        console.error('❌ GetResults search failed:', err.message);
        return [];
    }
}
// ============================================================
// FALLBACK: iTunes API (30-sec preview only)
// ============================================================
async function searchITunes(query) {
    try {
        const response = await axios.get('https://itunes.apple.com/search', {
            params: { term: query, media: 'music', limit: 20 },
            timeout: 8000
        });
        if (!response.data || !response.data.results) return [];
        return response.data.results
            .filter(track => track.previewUrl)
            .map(track => ({
                title: track.trackName,
                artist: track.artistName,
                image: track.artworkUrl100.replace('100x100bb', '500x500bb'),
                audioUrl: track.previewUrl,
                duration: Math.floor(track.trackTimeMillis / 1000).toString(),
                album: track.collectionName || '',
                quality: 'preview'
            }));
    } catch (err) {
        console.error('❌ iTunes API Error:', err.message);
        return [];
    }
}
// ============================================================
// API ENDPOINT — /api/search
// ============================================================
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.song || req.query.q || req.query.query;
        if (!query) return res.json([]);
        console.log('\n🔎 Searching:', query);
        // Method 1: Song Details (most reliable for full decrypted URLs)
        let songs = await searchViaSongDetails(query);
        if (songs.length > 0) {
            console.log(`✅ Method 1 (SongDetails): ${songs.length} songs | Quality: ${songs[0].quality}`);
            return res.json(songs);
        }
        // Method 2: search.getResults (alternative)
        console.log('⏳ Trying Method 2 (GetResults)...');
        songs = await searchViaGetResults(query);
        if (songs.length > 0) {
            console.log(`✅ Method 2 (GetResults): ${songs.length} songs | Quality: ${songs[0].quality}`);
            return res.json(songs);
        }
        // Method 3: iTunes fallback (30-sec preview)
        console.log('⏳ Trying iTunes fallback...');
        songs = await searchITunes(query);
        if (songs.length > 0) {
            console.log(`⚠️ iTunes Fallback: ${songs.length} preview tracks`);
            return res.json(songs);
        }
        console.log('❌ No songs found anywhere');
        res.json([]);
    } catch (err) {
        console.error('❌ Server Error:', err.message);
        res.status(500).json({ error: 'Music API failed', message: err.message });
    }
});
// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Music server is running ✅' });
});
// ============================================================
// START SERVER
// ============================================================
const PORT = 3000;
app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║   🎵 Pro Music Server — Full Songs (320kbps)     ║');
    console.log(`║   🌐 http://localhost:${PORT}                      ║`);
    console.log(`║   📡 API: http://localhost:${PORT}/api/search       ║`);
    console.log('║   🔍 Test: ?song=tum+hi+ho                       ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');
});
});
