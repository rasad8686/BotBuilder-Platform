// Widget initialization for test page
// Get botId from URL parameter: /test.html?botId=123
var urlParams = new URLSearchParams(window.location.search);
var botId = urlParams.get('botId') || '99';

bbWidget('init', {
  botId: botId,
  botName: 'Test Bot',
  welcomeMessage: 'Salam! Bu test mesajıdır. Nə ilə kömək edə bilərəm?',
  primaryColor: '#8b5cf6'
});
