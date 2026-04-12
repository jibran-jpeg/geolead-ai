/**
 * GeoLead AI — Service Worker Keep-Alive (Manifest V3)
 *
 * Prevents the background service worker from going to sleep after 30 seconds
 * of inactivity during long scraping or batch AI enrichment sessions.
 */

let keepAliveInterval = null;

/**
 * Starts sending periodic pings to keep the service worker alive.
 * Should be called from a content script or popup when a long task starts.
 */
export function startKeepAlive(source = 'popup') {
    if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
    }
    
    // Ping the background script every 20 seconds
    keepAliveInterval = setInterval(() => {
        chrome.runtime.sendMessage({ type: 'PING_KEEP_ALIVE', source }).catch(() => {
            // Ignore error if background is dead, another ping will try again
        });
    }, 20000);
    
    console.log(`[GeoLead ${source}] Keep-alive started`);
}

/**
 * Stops the keep-alive pings.
 */
export function stopKeepAlive() {
    if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
        console.log('[GeoLead] Keep-alive stopped');
    }
}
