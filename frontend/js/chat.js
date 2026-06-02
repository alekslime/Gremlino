async function sendMessage() {

    const prompt =
        document.getElementById("prompt").value;

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

    document.getElementById(
        "response"
    ).innerText =
        data.response;
}