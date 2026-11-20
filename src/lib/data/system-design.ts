interface SystemDesignTopic {
  id: string;
  title: string;
  prompt: string;
  archived?: boolean;
}

// Keep IDs stable. Archive a topic to hide it from setup while preserving saved interviews.
export const systemDesignTopics: SystemDesignTopic[] = [
  {
    id: "url-shortener",
    title: "URL shortener",
    prompt: "Design a service where people can create a short link for a long URL and visitors can use that link to reach its destination.",
  },
  {
    id: "notification-service",
    title: "Notification service",
    prompt: "Design a service that lets applications send notifications to users through email, push, or SMS while respecting each user's delivery preferences.",
  },
];

export function systemDesignTopicById(id: string) {
  return systemDesignTopics.find(topic => topic.id === id);
}
