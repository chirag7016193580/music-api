const express = require("express");
const cors = require("cors");
const axios = require("axios");
 
const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        status: true,
        message: "Music API Running Successfully 🎵",
        endpoint: "/api/search?song=kesariya"
    });
});

app.get("/api/search", async (req, res) => {
    try {
        const query = req.query.song;

        if (!query) {
            return res.status(400).json({
                status: false,
                error: "song query required"
            });
        }

        console.log(`🔍 Searching: ${query}`);

        // Updated Saavn API
        const url = `https://saavn.dev/api/search/songs?query=${encodeURIComponent(query)}`;

        const response = await axios.get(url, {
            timeout: 10000,
            headers: {
                "User-Agent": "Mozilla/5.0"
            }
        });

        const results = response?.data?.data?.results || [];

        if (!results.length) {
            return res.json({
                status: false,
                message: "No songs found"
            });
        }

        const songs = results.map((song) => {

            // Highest quality image
            let image =
                song.image?.[song.image.length - 1]?.url ||
                "https://via.placeholder.com/300";

            // Highest quality audio
            let audio =
                song.downloadUrl?.[song.downloadUrl.length - 1]?.url ||
                "";

            return {
                id: song.id,
                title: song.name,
                artist: song.primaryArtists,
                album: song.album?.name || "",
                duration: song.duration,
                image: image,
                audioUrl: audio
            };
        });

        // Only valid songs
        const validSongs = songs.filter(song => song.audioUrl);

        res.json({
            status: true,
            total: validSongs.length,
            results: validSongs
        });

    } catch (error) {

        console.error("❌ ERROR:", error.message);

        res.status(500).json({
            status: false,
            error: "Server Error",
            message: error.message
        });
    }
});

// Local server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});

module.exports = app;
