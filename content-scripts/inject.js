(() => {

    if (window.__codeVaultInjectorLoaded) return;
    window.__codeVaultInjectorLoaded = true;

    console.log("✅ CodeVault Injector Loaded");

    // -----------------------------
    // FETCH Interceptor
    // -----------------------------

    const originalFetch = window.fetch;

    window.fetch = async (...args) => {

        const response = await originalFetch(...args);

        try {

            const input = args[0];
            const options = args[1];

            const url =
                typeof input === "string"
                    ? input
                    : input.url;

            if (!url.includes("/graphql"))
                return response;

            if (!options?.body)
                return response;

            const request = JSON.parse(options.body);

            if (request.operationName !== "submissionDetails")
                return response;

            const json = await response.clone().json();

            console.log("📦 submissionDetails (FETCH)", json);

            window.postMessage({
                source: "CodeVault",
                type: "submissionDetails",
                request,
                response: json
            }, "*");

        } catch (err) {
            console.error("Fetch interceptor error:", err);
        }

        return response;
    };

    // -----------------------------
    // XHR Interceptor
    // -----------------------------

    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {

        this._url = url;

        return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (body) {

        try {

            if (
                this._url &&
                this._url.includes("/graphql") &&
                body
            ) {

                const request = JSON.parse(body);

                if (request.operationName === "submissionDetails") {

                    const xhr = this;

                    xhr.addEventListener("load", function () {

                        try {

                            const response = xhr.response;

if (response instanceof Blob) {

    response.text().then(text => {

        try {

            const json = JSON.parse(text);

            console.log("📦 submissionDetails (XHR)", json);

            window.postMessage({
                source: "CodeVault",
                type: "submissionDetails",
                request,
                response: json
            }, "*");

        } catch (e) {
            console.error("JSON Parse Error:", e);
        }

    });

}
else {

    const json =
        typeof response === "string"
            ? JSON.parse(response)
            : response;

    console.log("📦 submissionDetails (XHR)", json);

    window.postMessage({
        source: "CodeVault",
        type: "submissionDetails",
        request,
        response: json
    }, "*");

}

                        } catch (e) {
                            console.error("XHR response parse failed", e);
                        }

                    });

                }

            }

        } catch (e) {
            console.error(e);
        }

        return originalSend.apply(this, arguments);
    };

})();