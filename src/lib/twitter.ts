export async function checkUserTweetContains(username: string, keyword: string) {
    try {
        const response = await fetch(`/api/twitter/user/last_tweets?userName=${username}`);

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