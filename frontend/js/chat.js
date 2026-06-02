async function sendMessage() {

    const input =
        document.getElementById("prompt");

    const prompt =
        input.value.trim();

    if (!prompt) {
        return;
    }

    document.getElementById(
        "welcome"
    ).style.display = "none";

    const messages =
        document.getElementById(
            "messages"
        );

    const userMessage =
        document.createElement("div");

    userMessage.className =
        "message user";

    userMessage.textContent =
        prompt;

    messages.appendChild(
        userMessage
    );

    input.value = "";

    messages.scrollTop =
        messages.scrollHeight;

    try {

        const response =
            await fetch(
                "http://localhost:7000/api/chat/",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                        "application/json"
                    },
                    body: JSON.stringify({
                        prompt
                    })
                }
            );

        const data =
            await response.json();

        const aiMessage =
            document.createElement(
                "div"
            );

        aiMessage.className =
            "message ai";

        aiMessage.textContent =
            data.response;

        messages.appendChild(
            aiMessage
        );

        messages.scrollTop =
            messages.scrollHeight;

    } catch {

        const aiMessage =
            document.createElement(
                "div"
            );

        aiMessage.className =
            "message ai";

        aiMessage.textContent =
            "Gremlino growls: backend unreachable.";

        messages.appendChild(
            aiMessage
        );
    }
}

document
    .getElementById("prompt")
    .addEventListener(
        "keydown",
        function (e) {

            if (
                e.key === "Enter" &&
                !e.shiftKey
            ) {
                e.preventDefault();
                sendMessage();
            }
        }
    );