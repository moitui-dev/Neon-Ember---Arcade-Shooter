export async function initVoiceChat() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        console.log("Microphone access granted for online lobby voice communication.");
        return stream;
    } catch (error) {
        console.warn("Microphone access denied or unavailable:", error);
        return null;
    }
}