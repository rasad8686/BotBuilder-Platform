/**
 * Pre-built flow templates for common use cases
 */

const TEMPLATES = [
  {
    id: 'customer_support',
    name: 'Customer Support Bot',
    description: 'Handle customer inquiries, complaints, and support requests',
    category: 'support',
    icon: 'headset',
    difficulty: 'beginner',
    estimatedNodes: 12,
    features: ['FAQ handling', 'Ticket creation', 'Agent handoff', 'Satisfaction survey'],
    flow: {
      nodes: [
        {
          id: 'start_1',
          type: 'start',
          position: { x: 100, y: 100 },
          data: { label: 'Start', content: '' },
          isStart: true
        },
        {
          id: 'welcome_msg',
          type: 'message',
          position: { x: 100, y: 200 },
          data: {
            label: 'Welcome Message',
            content: 'Hello! Welcome to our support center. How can I help you today?'
          }
        },
        {
          id: 'main_menu',
          type: 'menu',
          position: { x: 100, y: 300 },
          data: {
            label: 'Main Menu',
            content: 'Please select an option:',
            options: [
              { id: 'opt1', label: 'Technical Support', value: 'technical' },
              { id: 'opt2', label: 'Billing Questions', value: 'billing' },
              { id: 'opt3', label: 'General Inquiry', value: 'general' },
              { id: 'opt4', label: 'Talk to Agent', value: 'agent' }
            ]
          }
        },
        {
          id: 'tech_support',
          type: 'message',
          position: { x: -100, y: 450 },
          data: {
            label: 'Technical Support',
            content: 'I can help with technical issues. Please describe your problem.'
          }
        },
        {
          id: 'billing_support',
          type: 'message',
          position: { x: 100, y: 450 },
          data: {
            label: 'Billing Support',
            content: 'For billing questions, please provide your account number.'
          }
        },
        {
          id: 'general_inquiry',
          type: 'message',
          position: { x: 300, y: 450 },
          data: {
            label: 'General Inquiry',
            content: 'What would you like to know about our services?'
          }
        },
        {
          id: 'agent_handoff',
          type: 'action',
          position: { x: 500, y: 450 },
          data: {
            label: 'Agent Handoff',
            content: 'Connecting you to a live agent...',
            actionType: 'handoff'
          }
        },
        {
          id: 'collect_issue',
          type: 'input',
          position: { x: 100, y: 600 },
          data: {
            label: 'Collect Issue',
            content: 'Please describe your issue in detail:',
            variableName: 'user_issue'
          }
        },
        {
          id: 'create_ticket',
          type: 'action',
          position: { x: 100, y: 750 },
          data: {
            label: 'Create Ticket',
            content: 'Creating support ticket...',
            actionType: 'create_ticket'
          }
        },
        {
          id: 'confirmation',
          type: 'message',
          position: { x: 100, y: 900 },
          data: {
            label: 'Confirmation',
            content: 'Your ticket has been created. Reference number: {{ticket_id}}. We will get back to you within 24 hours.'
          }
        },
        {
          id: 'satisfaction',
          type: 'question',
          position: { x: 100, y: 1050 },
          data: {
            label: 'Satisfaction Survey',
            content: 'How would you rate your experience?',
            options: ['Excellent', 'Good', 'Average', 'Poor']
          }
        },
        {
          id: 'end_1',
          type: 'end',
          position: { x: 100, y: 1200 },
          data: { label: 'End', content: 'Thank you for contacting us!' }
        }
      ],
      edges: [
        { id: 'e1', source: 'start_1', target: 'welcome_msg' },
        { id: 'e2', source: 'welcome_msg', target: 'main_menu' },
        { id: 'e3', source: 'main_menu', target: 'tech_support', label: 'technical' },
        { id: 'e4', source: 'main_menu', target: 'billing_support', label: 'billing' },
        { id: 'e5', source: 'main_menu', target: 'general_inquiry', label: 'general' },
        { id: 'e6', source: 'main_menu', target: 'agent_handoff', label: 'agent' },
        { id: 'e7', source: 'tech_support', target: 'collect_issue' },
        { id: 'e8', source: 'billing_support', target: 'collect_issue' },
        { id: 'e9', source: 'general_inquiry', target: 'collect_issue' },
        { id: 'e10', source: 'collect_issue', target: 'create_ticket' },
        { id: 'e11', source: 'create_ticket', target: 'confirmation' },
        { id: 'e12', source: 'confirmation', target: 'satisfaction' },
        { id: 'e13', source: 'satisfaction', target: 'end_1' }
      ],
      variables: [
        { name: 'user_issue', type: 'string', defaultValue: '' },
        { name: 'ticket_id', type: 'string', defaultValue: '' },
        { name: 'satisfaction_rating', type: 'string', defaultValue: '' }
      ]
    }
  },
  {
    id: 'lead_generation',
    name: 'Lead Generation Bot',
    description: 'Capture leads, qualify prospects, and schedule demos',
    category: 'sales',
    icon: 'user-plus',
    difficulty: 'intermediate',
    estimatedNodes: 15,
    features: ['Lead capture', 'Qualification questions', 'Demo scheduling', 'CRM integration'],
    flow: {
      nodes: [
        {
          id: 'start_1',
          type: 'start',
          position: { x: 100, y: 100 },
          data: { label: 'Start', content: '' },
          isStart: true
        },
        {
          id: 'greeting',
          type: 'message',
          position: { x: 100, y: 200 },
          data: {
            label: 'Greeting',
            content: 'Hi there! I\'m here to help you learn more about our solution. Would you like a personalized demo?'
          }
        },
        {
          id: 'interest_check',
          type: 'question',
          position: { x: 100, y: 300 },
          data: {
            label: 'Interest Check',
            content: 'What brings you here today?',
            options: ['Schedule a demo', 'Get pricing info', 'Learn about features', 'Just browsing']
          }
        },
        {
          id: 'collect_name',
          type: 'input',
          position: { x: -100, y: 450 },
          data: {
            label: 'Collect Name',
            content: 'Great! What\'s your name?',
            variableName: 'lead_name'
          }
        },
        {
          id: 'collect_email',
          type: 'input',
          position: { x: -100, y: 550 },
          data: {
            label: 'Collect Email',
            content: 'Nice to meet you, {{lead_name}}! What\'s your work email?',
            variableName: 'lead_email',
            validation: 'email'
          }
        },
        {
          id: 'collect_company',
          type: 'input',
          position: { x: -100, y: 650 },
          data: {
            label: 'Collect Company',
            content: 'Which company do you work for?',
            variableName: 'lead_company'
          }
        },
        {
          id: 'company_size',
          type: 'question',
          position: { x: -100, y: 750 },
          data: {
            label: 'Company Size',
            content: 'How many employees does your company have?',
            options: ['1-10', '11-50', '51-200', '201-1000', '1000+']
          }
        },
        {
          id: 'qualify_budget',
          type: 'question',
          position: { x: -100, y: 850 },
          data: {
            label: 'Budget Qualification',
            content: 'What\'s your approximate budget for this type of solution?',
            options: ['Under $1k/mo', '$1k-5k/mo', '$5k-10k/mo', 'Over $10k/mo', 'Not sure yet']
          }
        },
        {
          id: 'schedule_demo',
          type: 'action',
          position: { x: -100, y: 950 },
          data: {
            label: 'Schedule Demo',
            content: 'Perfect! Let me find available times for your demo.',
            actionType: 'calendly_embed'
          }
        },
        {
          id: 'pricing_info',
          type: 'message',
          position: { x: 100, y: 450 },
          data: {
            label: 'Pricing Info',
            content: 'Our pricing starts at $99/month for small teams. Would you like to speak with a sales rep for custom pricing?'
          }
        },
        {
          id: 'features_info',
          type: 'message',
          position: { x: 300, y: 450 },
          data: {
            label: 'Features Info',
            content: 'We offer: \n- Feature 1\n- Feature 2\n- Feature 3\n\nWant to see these in action?'
          }
        },
        {
          id: 'save_lead',
          type: 'api_call',
          position: { x: -100, y: 1050 },
          data: {
            label: 'Save Lead to CRM',
            content: 'Saving lead information...',
            endpoint: '/api/leads',
            method: 'POST'
          }
        },
        {
          id: 'confirmation',
          type: 'message',
          position: { x: -100, y: 1150 },
          data: {
            label: 'Confirmation',
            content: 'Awesome! You\'re all set, {{lead_name}}. Check your email for the calendar invite. See you soon!'
          }
        },
        {
          id: 'browsing_exit',
          type: 'message',
          position: { x: 500, y: 450 },
          data: {
            label: 'Browsing Exit',
            content: 'No problem! Feel free to explore our website. I\'m here if you have any questions.'
          }
        },
        {
          id: 'end_1',
          type: 'end',
          position: { x: 100, y: 1250 },
          data: { label: 'End', content: '' }
        }
      ],
      edges: [
        { id: 'e1', source: 'start_1', target: 'greeting' },
        { id: 'e2', source: 'greeting', target: 'interest_check' },
        { id: 'e3', source: 'interest_check', target: 'collect_name', label: 'demo' },
        { id: 'e4', source: 'interest_check', target: 'pricing_info', label: 'pricing' },
        { id: 'e5', source: 'interest_check', target: 'features_info', label: 'features' },
        { id: 'e6', source: 'interest_check', target: 'browsing_exit', label: 'browsing' },
        { id: 'e7', source: 'collect_name', target: 'collect_email' },
        { id: 'e8', source: 'collect_email', target: 'collect_company' },
        { id: 'e9', source: 'collect_company', target: 'company_size' },
        { id: 'e10', source: 'company_size', target: 'qualify_budget' },
        { id: 'e11', source: 'qualify_budget', target: 'schedule_demo' },
        { id: 'e12', source: 'schedule_demo', target: 'save_lead' },
        { id: 'e13', source: 'save_lead', target: 'confirmation' },
        { id: 'e14', source: 'confirmation', target: 'end_1' },
        { id: 'e15', source: 'pricing_info', target: 'collect_name' },
        { id: 'e16', source: 'features_info', target: 'collect_name' },
        { id: 'e17', source: 'browsing_exit', target: 'end_1' }
      ],
      variables: [
        { name: 'lead_name', type: 'string', defaultValue: '' },
        { name: 'lead_email', type: 'string', defaultValue: '' },
        { name: 'lead_company', type: 'string', defaultValue: '' },
        { name: 'company_size', type: 'string', defaultValue: '' },
        { name: 'budget_range', type: 'string', defaultValue: '' }
      ]
    }
  },
  {
    id: 'faq_bot',
    name: 'FAQ Bot',
    description: 'Answer frequently asked questions automatically',
    category: 'support',
    icon: 'help-circle',
    difficulty: 'beginner',
    estimatedNodes: 10,
    features: ['Category navigation', 'Search functionality', 'AI-powered answers', 'Fallback to human'],
    flow: {
      nodes: [
        {
          id: 'start_1',
          type: 'start',
          position: { x: 100, y: 100 },
          data: { label: 'Start', content: '' },
          isStart: true
        },
        {
          id: 'welcome',
          type: 'message',
          position: { x: 100, y: 200 },
          data: {
            label: 'Welcome',
            content: 'Hello! I can help answer your questions. What would you like to know about?'
          }
        },
        {
          id: 'category_select',
          type: 'menu',
          position: { x: 100, y: 300 },
          data: {
            label: 'Select Category',
            content: 'Choose a topic:',
            options: [
              { id: 'cat1', label: 'Getting Started', value: 'getting_started' },
              { id: 'cat2', label: 'Account & Billing', value: 'account' },
              { id: 'cat3', label: 'Features & Usage', value: 'features' },
              { id: 'cat4', label: 'Troubleshooting', value: 'troubleshooting' },
              { id: 'cat5', label: 'Ask Something Else', value: 'other' }
            ]
          }
        },
        {
          id: 'getting_started_faq',
          type: 'message',
          position: { x: -200, y: 450 },
          data: {
            label: 'Getting Started FAQ',
            content: 'Here are common getting started questions:\n\n1. How do I create an account?\n2. How do I set up my first bot?\n3. Where can I find tutorials?'
          }
        },
        {
          id: 'account_faq',
          type: 'message',
          position: { x: 0, y: 450 },
          data: {
            label: 'Account FAQ',
            content: 'Common account questions:\n\n1. How do I reset my password?\n2. How do I upgrade my plan?\n3. How do I cancel my subscription?'
          }
        },
        {
          id: 'features_faq',
          type: 'message',
          position: { x: 200, y: 450 },
          data: {
            label: 'Features FAQ',
            content: 'Feature questions:\n\n1. What integrations are available?\n2. How many bots can I create?\n3. Is there an API?'
          }
        },
        {
          id: 'troubleshooting_faq',
          type: 'message',
          position: { x: 400, y: 450 },
          data: {
            label: 'Troubleshooting FAQ',
            content: 'Common issues:\n\n1. Bot not responding\n2. Integration not working\n3. Messages not sending'
          }
        },
        {
          id: 'free_question',
          type: 'input',
          position: { x: 600, y: 450 },
          data: {
            label: 'Free Question',
            content: 'Please type your question:',
            variableName: 'user_question'
          }
        },
        {
          id: 'ai_answer',
          type: 'ai_response',
          position: { x: 600, y: 550 },
          data: {
            label: 'AI Answer',
            content: 'Let me find the answer for you...',
            useKnowledgeBase: true
          }
        },
        {
          id: 'helpful_check',
          type: 'question',
          position: { x: 100, y: 600 },
          data: {
            label: 'Was this helpful?',
            content: 'Did this answer your question?',
            options: ['Yes, thanks!', 'I need more help']
          }
        },
        {
          id: 'end_success',
          type: 'end',
          position: { x: 0, y: 750 },
          data: { label: 'End - Success', content: 'Great! Happy to help. Feel free to come back anytime!' }
        },
        {
          id: 'escalate',
          type: 'action',
          position: { x: 200, y: 750 },
          data: {
            label: 'Escalate to Human',
            content: 'Let me connect you with a human agent...',
            actionType: 'handoff'
          }
        }
      ],
      edges: [
        { id: 'e1', source: 'start_1', target: 'welcome' },
        { id: 'e2', source: 'welcome', target: 'category_select' },
        { id: 'e3', source: 'category_select', target: 'getting_started_faq', label: 'getting_started' },
        { id: 'e4', source: 'category_select', target: 'account_faq', label: 'account' },
        { id: 'e5', source: 'category_select', target: 'features_faq', label: 'features' },
        { id: 'e6', source: 'category_select', target: 'troubleshooting_faq', label: 'troubleshooting' },
        { id: 'e7', source: 'category_select', target: 'free_question', label: 'other' },
        { id: 'e8', source: 'getting_started_faq', target: 'helpful_check' },
        { id: 'e9', source: 'account_faq', target: 'helpful_check' },
        { id: 'e10', source: 'features_faq', target: 'helpful_check' },
        { id: 'e11', source: 'troubleshooting_faq', target: 'helpful_check' },
        { id: 'e12', source: 'free_question', target: 'ai_answer' },
        { id: 'e13', source: 'ai_answer', target: 'helpful_check' },
        { id: 'e14', source: 'helpful_check', target: 'end_success', label: 'yes' },
        { id: 'e15', source: 'helpful_check', target: 'escalate', label: 'no' }
      ],
      variables: [
        { name: 'user_question', type: 'string', defaultValue: '' },
        { name: 'selected_category', type: 'string', defaultValue: '' }
      ]
    }
  },
  {
    id: 'appointment_booking',
    name: 'Appointment Booking Bot',
    description: 'Schedule appointments, manage bookings, and send reminders',
    category: 'scheduling',
    icon: 'calendar',
    difficulty: 'intermediate',
    estimatedNodes: 14,
    features: ['Service selection', 'Date/time picker', 'Confirmation', 'Reminders'],
    flow: {
      nodes: [
        {
          id: 'start_1',
          type: 'start',
          position: { x: 100, y: 100 },
          data: { label: 'Start', content: '' },
          isStart: true
        },
        {
          id: 'welcome',
          type: 'message',
          position: { x: 100, y: 200 },
          data: {
            label: 'Welcome',
            content: 'Welcome to our booking system! I\'ll help you schedule an appointment.'
          }
        },
        {
          id: 'select_service',
          type: 'menu',
          position: { x: 100, y: 300 },
          data: {
            label: 'Select Service',
            content: 'What service would you like to book?',
            options: [
              { id: 's1', label: 'Consultation (30 min)', value: 'consultation' },
              { id: 's2', label: 'Full Service (1 hour)', value: 'full_service' },
              { id: 's3', label: 'Follow-up (15 min)', value: 'followup' }
            ]
          }
        },
        {
          id: 'collect_name',
          type: 'input',
          position: { x: 100, y: 400 },
          data: {
            label: 'Your Name',
            content: 'Please enter your full name:',
            variableName: 'customer_name'
          }
        },
        {
          id: 'collect_phone',
          type: 'input',
          position: { x: 100, y: 500 },
          data: {
            label: 'Phone Number',
            content: 'What\'s your phone number?',
            variableName: 'customer_phone',
            validation: 'phone'
          }
        },
        {
          id: 'collect_email',
          type: 'input',
          position: { x: 100, y: 600 },
          data: {
            label: 'Email',
            content: 'What\'s your email address?',
            variableName: 'customer_email',
            validation: 'email'
          }
        },
        {
          id: 'select_date',
          type: 'input',
          position: { x: 100, y: 700 },
          data: {
            label: 'Select Date',
            content: 'What date works best for you? (e.g., Monday, Dec 15)',
            variableName: 'appointment_date',
            inputType: 'date'
          }
        },
        {
          id: 'show_times',
          type: 'menu',
          position: { x: 100, y: 800 },
          data: {
            label: 'Available Times',
            content: 'Here are available times for {{appointment_date}}:',
            options: [
              { id: 't1', label: '9:00 AM', value: '09:00' },
              { id: 't2', label: '10:00 AM', value: '10:00' },
              { id: 't3', label: '11:00 AM', value: '11:00' },
              { id: 't4', label: '2:00 PM', value: '14:00' },
              { id: 't5', label: '3:00 PM', value: '15:00' }
            ]
          }
        },
        {
          id: 'confirm_booking',
          type: 'question',
          position: { x: 100, y: 900 },
          data: {
            label: 'Confirm Booking',
            content: 'Please confirm your appointment:\n\nService: {{selected_service}}\nDate: {{appointment_date}}\nTime: {{appointment_time}}\nName: {{customer_name}}',
            options: ['Confirm', 'Start Over']
          }
        },
        {
          id: 'save_booking',
          type: 'api_call',
          position: { x: 0, y: 1050 },
          data: {
            label: 'Save Booking',
            content: 'Saving your appointment...',
            endpoint: '/api/bookings',
            method: 'POST'
          }
        },
        {
          id: 'send_confirmation',
          type: 'email',
          position: { x: 0, y: 1150 },
          data: {
            label: 'Send Confirmation Email',
            content: 'Sending confirmation email...',
            template: 'booking_confirmation'
          }
        },
        {
          id: 'success_message',
          type: 'message',
          position: { x: 0, y: 1250 },
          data: {
            label: 'Success',
            content: 'Your appointment is confirmed! You\'ll receive a confirmation email at {{customer_email}}. See you on {{appointment_date}} at {{appointment_time}}!'
          }
        },
        {
          id: 'end_1',
          type: 'end',
          position: { x: 100, y: 1350 },
          data: { label: 'End', content: '' }
        }
      ],
      edges: [
        { id: 'e1', source: 'start_1', target: 'welcome' },
        { id: 'e2', source: 'welcome', target: 'select_service' },
        { id: 'e3', source: 'select_service', target: 'collect_name' },
        { id: 'e4', source: 'collect_name', target: 'collect_phone' },
        { id: 'e5', source: 'collect_phone', target: 'collect_email' },
        { id: 'e6', source: 'collect_email', target: 'select_date' },
        { id: 'e7', source: 'select_date', target: 'show_times' },
        { id: 'e8', source: 'show_times', target: 'confirm_booking' },
        { id: 'e9', source: 'confirm_booking', target: 'save_booking', label: 'confirm' },
        { id: 'e10', source: 'confirm_booking', target: 'select_service', label: 'start_over' },
        { id: 'e11', source: 'save_booking', target: 'send_confirmation' },
        { id: 'e12', source: 'send_confirmation', target: 'success_message' },
        { id: 'e13', source: 'success_message', target: 'end_1' }
      ],
      variables: [
        { name: 'customer_name', type: 'string', defaultValue: '' },
        { name: 'customer_phone', type: 'string', defaultValue: '' },
        { name: 'customer_email', type: 'string', defaultValue: '' },
        { name: 'selected_service', type: 'string', defaultValue: '' },
        { name: 'appointment_date', type: 'string', defaultValue: '' },
        { name: 'appointment_time', type: 'string', defaultValue: '' },
        { name: 'booking_id', type: 'string', defaultValue: '' }
      ]
    }
  },
  {
    id: 'ecommerce_support',
    name: 'E-commerce Support Bot',
    description: 'Handle order inquiries, returns, and shopping assistance',
    category: 'ecommerce',
    icon: 'shopping-cart',
    difficulty: 'advanced',
    estimatedNodes: 18,
    features: ['Order tracking', 'Return requests', 'Product recommendations', 'Cart recovery'],
    flow: {
      nodes: [
        {
          id: 'start_1',
          type: 'start',
          position: { x: 100, y: 100 },
          data: { label: 'Start', content: '' },
          isStart: true
        },
        {
          id: 'welcome',
          type: 'message',
          position: { x: 100, y: 200 },
          data: {
            label: 'Welcome',
            content: 'Hi! Welcome to our store. How can I help you today?'
          }
        },
        {
          id: 'main_menu',
          type: 'menu',
          position: { x: 100, y: 300 },
          data: {
            label: 'Main Menu',
            content: 'What would you like to do?',
            options: [
              { id: 'm1', label: 'Track My Order', value: 'track' },
              { id: 'm2', label: 'Return/Exchange', value: 'return' },
              { id: 'm3', label: 'Product Questions', value: 'product' },
              { id: 'm4', label: 'Talk to Agent', value: 'agent' }
            ]
          }
        },
        {
          id: 'ask_order_number',
          type: 'input',
          position: { x: -150, y: 450 },
          data: {
            label: 'Order Number',
            content: 'Please enter your order number:',
            variableName: 'order_number'
          }
        },
        {
          id: 'fetch_order',
          type: 'api_call',
          position: { x: -150, y: 550 },
          data: {
            label: 'Fetch Order',
            content: 'Looking up your order...',
            endpoint: '/api/orders/{{order_number}}',
            method: 'GET'
          }
        },
        {
          id: 'show_order_status',
          type: 'message',
          position: { x: -150, y: 650 },
          data: {
            label: 'Order Status',
            content: 'Order #{{order_number}}\nStatus: {{order_status}}\nExpected delivery: {{delivery_date}}'
          }
        },
        {
          id: 'return_reason',
          type: 'menu',
          position: { x: 50, y: 450 },
          data: {
            label: 'Return Reason',
            content: 'Why would you like to return/exchange?',
            options: [
              { id: 'r1', label: 'Wrong size', value: 'size' },
              { id: 'r2', label: 'Defective item', value: 'defective' },
              { id: 'r3', label: 'Not as described', value: 'not_described' },
              { id: 'r4', label: 'Changed my mind', value: 'changed_mind' }
            ]
          }
        },
        {
          id: 'return_order_input',
          type: 'input',
          position: { x: 50, y: 550 },
          data: {
            label: 'Return Order Number',
            content: 'Please enter the order number for the item you want to return:',
            variableName: 'return_order_number'
          }
        },
        {
          id: 'create_return',
          type: 'api_call',
          position: { x: 50, y: 650 },
          data: {
            label: 'Create Return',
            content: 'Creating your return request...',
            endpoint: '/api/returns',
            method: 'POST'
          }
        },
        {
          id: 'return_confirmation',
          type: 'message',
          position: { x: 50, y: 750 },
          data: {
            label: 'Return Confirmation',
            content: 'Your return request has been created. Return label has been sent to your email. Please ship within 14 days.'
          }
        },
        {
          id: 'product_question',
          type: 'input',
          position: { x: 250, y: 450 },
          data: {
            label: 'Product Question',
            content: 'What product are you interested in or have questions about?',
            variableName: 'product_query'
          }
        },
        {
          id: 'ai_product_answer',
          type: 'ai_response',
          position: { x: 250, y: 550 },
          data: {
            label: 'AI Product Answer',
            content: 'Finding information about that product...',
            useKnowledgeBase: true
          }
        },
        {
          id: 'recommend_products',
          type: 'message',
          position: { x: 250, y: 650 },
          data: {
            label: 'Recommendations',
            content: 'Based on your interest, you might also like:\n{{recommended_products}}'
          }
        },
        {
          id: 'agent_handoff',
          type: 'action',
          position: { x: 450, y: 450 },
          data: {
            label: 'Connect to Agent',
            content: 'Connecting you to a customer service agent...',
            actionType: 'handoff'
          }
        },
        {
          id: 'anything_else',
          type: 'question',
          position: { x: 100, y: 850 },
          data: {
            label: 'Anything Else?',
            content: 'Is there anything else I can help you with?',
            options: ['Yes', 'No, thanks!']
          }
        },
        {
          id: 'end_1',
          type: 'end',
          position: { x: 100, y: 1000 },
          data: { label: 'End', content: 'Thank you for shopping with us!' }
        }
      ],
      edges: [
        { id: 'e1', source: 'start_1', target: 'welcome' },
        { id: 'e2', source: 'welcome', target: 'main_menu' },
        { id: 'e3', source: 'main_menu', target: 'ask_order_number', label: 'track' },
        { id: 'e4', source: 'main_menu', target: 'return_reason', label: 'return' },
        { id: 'e5', source: 'main_menu', target: 'product_question', label: 'product' },
        { id: 'e6', source: 'main_menu', target: 'agent_handoff', label: 'agent' },
        { id: 'e7', source: 'ask_order_number', target: 'fetch_order' },
        { id: 'e8', source: 'fetch_order', target: 'show_order_status' },
        { id: 'e9', source: 'show_order_status', target: 'anything_else' },
        { id: 'e10', source: 'return_reason', target: 'return_order_input' },
        { id: 'e11', source: 'return_order_input', target: 'create_return' },
        { id: 'e12', source: 'create_return', target: 'return_confirmation' },
        { id: 'e13', source: 'return_confirmation', target: 'anything_else' },
        { id: 'e14', source: 'product_question', target: 'ai_product_answer' },
        { id: 'e15', source: 'ai_product_answer', target: 'recommend_products' },
        { id: 'e16', source: 'recommend_products', target: 'anything_else' },
        { id: 'e17', source: 'anything_else', target: 'main_menu', label: 'yes' },
        { id: 'e18', source: 'anything_else', target: 'end_1', label: 'no' }
      ],
      variables: [
        { name: 'order_number', type: 'string', defaultValue: '' },
        { name: 'order_status', type: 'string', defaultValue: '' },
        { name: 'delivery_date', type: 'string', defaultValue: '' },
        { name: 'return_order_number', type: 'string', defaultValue: '' },
        { name: 'return_reason', type: 'string', defaultValue: '' },
        { name: 'product_query', type: 'string', defaultValue: '' },
        { name: 'recommended_products', type: 'string', defaultValue: '' }
      ]
    }
  },
  {
    id: 'feedback_collection',
    name: 'Feedback Collection Bot',
    description: 'Collect customer feedback, NPS scores, and reviews',
    category: 'feedback',
    icon: 'star',
    difficulty: 'beginner',
    estimatedNodes: 10,
    features: ['NPS survey', 'Rating collection', 'Open feedback', 'Thank you rewards'],
    flow: {
      nodes: [
        {
          id: 'start_1',
          type: 'start',
          position: { x: 100, y: 100 },
          data: { label: 'Start', content: '' },
          isStart: true
        },
        {
          id: 'intro',
          type: 'message',
          position: { x: 100, y: 200 },
          data: {
            label: 'Introduction',
            content: 'Hi! We\'d love to hear about your recent experience. This survey takes only 2 minutes.'
          }
        },
        {
          id: 'nps_question',
          type: 'question',
          position: { x: 100, y: 300 },
          data: {
            label: 'NPS Score',
            content: 'On a scale of 0-10, how likely are you to recommend us to a friend or colleague?',
            options: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']
          }
        },
        {
          id: 'nps_condition',
          type: 'condition',
          position: { x: 100, y: 400 },
          data: {
            label: 'NPS Check',
            content: 'Check NPS score',
            conditions: [
              { id: 'c1', operator: 'gte', value: '9', label: 'Promoter' },
              { id: 'c2', operator: 'gte', value: '7', label: 'Passive' },
              { id: 'c3', operator: 'lt', value: '7', label: 'Detractor' }
            ]
          }
        },
        {
          id: 'promoter_followup',
          type: 'input',
          position: { x: -100, y: 550 },
          data: {
            label: 'Promoter Followup',
            content: 'That\'s wonderful! What do you love most about us?',
            variableName: 'positive_feedback'
          }
        },
        {
          id: 'passive_followup',
          type: 'input',
          position: { x: 100, y: 550 },
          data: {
            label: 'Passive Followup',
            content: 'Thanks! What could we do better to earn a higher score?',
            variableName: 'improvement_feedback'
          }
        },
        {
          id: 'detractor_followup',
          type: 'input',
          position: { x: 300, y: 550 },
          data: {
            label: 'Detractor Followup',
            content: 'We\'re sorry to hear that. Please tell us what went wrong so we can improve.',
            variableName: 'negative_feedback'
          }
        },
        {
          id: 'save_feedback',
          type: 'api_call',
          position: { x: 100, y: 700 },
          data: {
            label: 'Save Feedback',
            content: 'Saving your feedback...',
            endpoint: '/api/feedback',
            method: 'POST'
          }
        },
        {
          id: 'thank_you',
          type: 'message',
          position: { x: 100, y: 850 },
          data: {
            label: 'Thank You',
            content: 'Thank you so much for your feedback! Your input helps us improve. As a token of appreciation, here\'s a 10% discount code: THANKYOU10'
          }
        },
        {
          id: 'end_1',
          type: 'end',
          position: { x: 100, y: 1000 },
          data: { label: 'End', content: '' }
        }
      ],
      edges: [
        { id: 'e1', source: 'start_1', target: 'intro' },
        { id: 'e2', source: 'intro', target: 'nps_question' },
        { id: 'e3', source: 'nps_question', target: 'nps_condition' },
        { id: 'e4', source: 'nps_condition', target: 'promoter_followup', label: 'promoter' },
        { id: 'e5', source: 'nps_condition', target: 'passive_followup', label: 'passive' },
        { id: 'e6', source: 'nps_condition', target: 'detractor_followup', label: 'detractor' },
        { id: 'e7', source: 'promoter_followup', target: 'save_feedback' },
        { id: 'e8', source: 'passive_followup', target: 'save_feedback' },
        { id: 'e9', source: 'detractor_followup', target: 'save_feedback' },
        { id: 'e10', source: 'save_feedback', target: 'thank_you' },
        { id: 'e11', source: 'thank_you', target: 'end_1' }
      ],
      variables: [
        { name: 'nps_score', type: 'number', defaultValue: 0 },
        { name: 'positive_feedback', type: 'string', defaultValue: '' },
        { name: 'improvement_feedback', type: 'string', defaultValue: '' },
        { name: 'negative_feedback', type: 'string', defaultValue: '' }
      ]
    }
  }
];

class FlowTemplates {
  /**
   * Get all available templates
   * @returns {array} List of templates with metadata (without full flow data)
   */
  static getTemplates() {
    return TEMPLATES.map(template => ({
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      icon: template.icon,
      difficulty: template.difficulty,
      estimatedNodes: template.estimatedNodes,
      features: template.features
    }));
  }

  /**
   * Get a specific template by ID
   * @param {string} id - Template ID
   * @returns {object|null} Full template with flow data
   */
  static getTemplateById(id) {
    return TEMPLATES.find(t => t.id === id) || null;
  }

  /**
   * Get templates by category
   * @param {string} category - Category name
   * @returns {array} Templates in that category
   */
  static getTemplatesByCategory(category) {
    return TEMPLATES
      .filter(t => t.category === category)
      .map(template => ({
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        icon: template.icon,
        difficulty: template.difficulty,
        estimatedNodes: template.estimatedNodes,
        features: template.features
      }));
  }

  /**
   * Get all categories
   * @returns {array} List of unique categories
   */
  static getCategories() {
    const categories = [...new Set(TEMPLATES.map(t => t.category))];
    return categories.map(cat => ({
      id: cat,
      name: cat.charAt(0).toUpperCase() + cat.slice(1),
      count: TEMPLATES.filter(t => t.category === cat).length
    }));
  }

  /**
   * Search templates
   * @param {string} query - Search query
   * @returns {array} Matching templates
   */
  static searchTemplates(query) {
    const lowerQuery = query.toLowerCase();
    return TEMPLATES
      .filter(t =>
        t.name.toLowerCase().includes(lowerQuery) ||
        t.description.toLowerCase().includes(lowerQuery) ||
        t.features.some(f => f.toLowerCase().includes(lowerQuery))
      )
      .map(template => ({
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        icon: template.icon,
        difficulty: template.difficulty,
        estimatedNodes: template.estimatedNodes,
        features: template.features
      }));
  }
}

module.exports = FlowTemplates;
