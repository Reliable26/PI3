export const sources = [
  {
    id: 'google-news-commercial-fire-charlotte',
    module: 'Commercial Fire Intelligence',
    type: 'google-news-rss',
    url: 'https://news.google.com/rss/search?q=(apartment%20fire%20OR%20commercial%20fire%20OR%20hotel%20fire%20OR%20warehouse%20fire)%20(Charlotte%20OR%20Mecklenburg%20OR%20Cabarrus%20OR%20Gaston%20OR%20Union%20County%20OR%20Iredell%20OR%20York%20County%20OR%20Lancaster%20County)&hl=en-US&gl=US&ceid=US:en',
    priority: 70
  },
  {
    id: 'google-news-charlotte-fire-news',
    module: 'Commercial Fire Intelligence',
    type: 'google-news-rss',
    url: 'https://news.google.com/rss/search?q=(Charlotte%20fire%20apartment%20OR%20Charlotte%20commercial%20fire%20OR%20Mecklenburg%20fire)%20when:7d&hl=en-US&gl=US&ceid=US:en',
    priority: 70
  }
];
