export async function initVoiceChat() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        console.log("Microphone access granted for spatial lobby voice chat.");

        // Audio context / WebRTC peer handling logic goes here for multiplayer rooms
        return stream;
    } catch (error) {
        console.warn("Microphone access denied or unavailable:", error);
        return null;
    }
}