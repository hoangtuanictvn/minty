const apiKey = import.meta.env.VITE_X_API_KEY; // Thay bằng x-api-key của bạn

export async function checkUserTweetContains(username: string, keyword: string) {
    try {
        const response = await fetch(`https://api.twitterapi.io/twitter/user/last_tweets?username=${username}`, {
            method: "GET",
            headers: {
                "X-Api-Key": apiKey,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        // Kiểm tra xem bất kỳ tweet nào chứa từ khóa
        const hasKeyword = data.tweets?.some(tweet => tweet.text.includes(keyword)) || false;

        return hasKeyword;
    } catch (error) {
        console.error("Error fetching tweets:", error);
        return false;
    }
}