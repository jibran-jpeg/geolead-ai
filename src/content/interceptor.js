// Google Maps API Interceptor
// Injected into the Main World to capture AJAX place details before they render in the DOM.
(function() {
    // 1. Intercept XMLHttpRequest
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url) {
        this._url = url;
        return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function() {
        this.addEventListener('load', function() {
            try {
                if (this._url && this._url.includes('/maps/preview/place')) {
                    let text = this.responseText;
                    if (text && text.startsWith(")]}'")) {
                        text = text.substring(4);
                    }
                    const parsed = JSON.parse(text);
                    window.postMessage({
                        type: 'GEOMEAD_API_RESPONSE',
                        url: this._url,
                        data: parsed
                    }, '*');
                }
            } catch (e) {
                // Fail silently in the page context
            }
        });
        return originalSend.apply(this, arguments);
    };

    // 2. Intercept fetch
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const response = await originalFetch.apply(this, args);
        try {
            const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url);
            if (url && url.includes('/maps/preview/place')) {
                const clone = response.clone();
                let text = await clone.text();
                if (text && text.startsWith(")]}'")) {
                    text = text.substring(4);
                }
                const parsed = JSON.parse(text);
                window.postMessage({
                    type: 'GEOMEAD_API_RESPONSE',
                    url: url,
                    data: parsed
                }, '*');
            }
        } catch (e) {
            // Fail silently in the page context
        }
        return response;
    };
})();
