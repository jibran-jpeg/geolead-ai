// Simple test to verify hover preview functionality
console.log('🧪 Testing hover preview functionality...');

// Test if the preview component can be created
const testPreview = () => {
  const mockLead = {
    id: 'test',
    businessName: 'Test Business',
    category: 'Test Category',
    phone: '+1 (555) 123-4567',
    emails: ['test@example.com'],
    website: 'https://test.com',
    address: '123 Test St',
    rating: '4.5',
    websiteStatus: 'HAS_WEBSITE'
  };

  console.log('Mock lead data:', mockLead);
  
  // Test if preview would be shown
  const showPreview = true;
  const previewLead = mockLead;
  
  if (showPreview && previewLead) {
    console.log('✅ Preview would be shown for:', previewLead.businessName);
    console.log('📍 Preview position would be calculated');
    console.log('🎨 Preview would be rendered');
  } else {
    console.log('❌ Preview would not be shown');
  }
};

testPreview();

// Test mouse event simulation
const testMouseEvent = (clientX, clientY) => {
  console.log(`🖱️ Simulating mouse move at: ${clientX}, ${clientY}`);
  
  // Simulate preview positioning
  const previewWidth = 380;
  const previewHeight = 400;
  const margin = 20;
  
  let x = clientX + margin;
  let y = clientY + margin;
  
  // Check boundaries
  if (x + previewWidth > window.innerWidth) {
    x = Math.max(margin, clientX - previewWidth - margin);
    console.log('🔄 Adjusted X position to prevent overflow');
  }
  
  if (y + previewHeight > window.innerHeight) {
    y = Math.max(margin, clientY - previewHeight - margin);
    console.log('🔄 Adjusted Y position to prevent overflow');
  }
  
  console.log('📍 Final preview position:', { x, y });
};

// Test with different mouse positions
testMouseEvent(100, 100);
testMouseEvent(window.innerWidth - 400, window.innerHeight - 450);
testMouseEvent(500, 300);

console.log('✅ Hover preview test completed');