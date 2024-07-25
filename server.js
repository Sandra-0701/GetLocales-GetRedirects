import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
 
const app = express();
app.use(cors());
app.use(express.json());
 
const MAX_REDIRECTIONS = 10;
const TIMEOUT = 10000; // Increased timeout to 10 seconds
 
// Function to ensure URL includes scheme
function ensureUrlScheme(url) {
    if (!/^https?:\/\//i.test(url)) {
        return `https://${url}`;
    }
    return url;
}
 
async function getFinalUrl(url, redirects = 0) {
    url = ensureUrlScheme(url);
 
    if (redirects >= MAX_REDIRECTIONS) {
        return { url, final: null, status: 'Too many redirects' };
    }
 
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);
 
    try {
        const response = await fetch(url, {
            redirect: 'manual',
            signal: controller.signal
        });
 
        clearTimeout(timeoutId);
 
        const status = response.status;
        if (status >= 300 && status < 400 && response.headers.has('location')) {
            let redirectUrl = response.headers.get('location');
            // Handle relative URLs
            if (redirectUrl.startsWith('/')) {
                const urlObj = new URL(url);
                redirectUrl = `${urlObj.protocol}//${urlObj.host}${redirectUrl}`;
            } else if (!redirectUrl.startsWith('http')) {
                redirectUrl = new URL(redirectUrl, url).href;
            }
            return getFinalUrl(redirectUrl, redirects + 1);
        }
 
        return { url, final: url, status };
    } catch (error) {
        const errorMessage = error.name === 'AbortError' ? 'Request timed out' : `Error: ${error.message}`;
        return { url, final: null, status: errorMessage };
    }
}
 
app.post('/getRedirectUrls', async (req, res) => {
    const { urls } = req.body;
    if (!Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: 'Invalid input' });
    }
 
    try {
        const results = await Promise.all(urls.map(url => getFinalUrl(url)));
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while processing URLs' });
    }
});
 
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});