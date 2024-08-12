import fetch from 'node-fetch';

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
        return { original: url, final: null, status: 'Too many redirects' };
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
            if (redirectUrl.startsWith('/')) {
                const urlObj = new URL(url);
                redirectUrl = `${urlObj.protocol}//${urlObj.host}${redirectUrl}`;
            } else if (!redirectUrl.startsWith('http')) {
                redirectUrl = new URL(redirectUrl, url).href;
            }
            return getFinalUrl(redirectUrl, redirects + 1);
        }

        return { original: url, final: url, status };
    } catch (error) {
        const errorMessage = error.name === 'AbortError' ? 'Request timed out' : `Error: ${error.message}`;
        return { original: url, final: null, status: errorMessage };
    }
}

export default async function handler(req, res) {
    if (req.method === 'POST') {
        const { urls } = req.body;

        if (!urls || !Array.isArray(urls)) {
            return res.status(400).json({ error: 'Invalid input: "urls" should be an array of URLs.' });
        }

        try {
            const results = await Promise.all(urls.map(url => getFinalUrl(url)));
            res.status(200).json(results);
        } catch (error) {
            res.status(500).json({ error: 'Failed to process URLs' });
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
