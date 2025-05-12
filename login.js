document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message');
    
    // For demo purposes, using a simple hardcoded check
    // In a real application, this should be handled server-side
    if (username === 'VSSP' && password === 'VSSP1234') {
        // Store login state
        localStorage.setItem('isLoggedIn', 'true');
        // Redirect to camera page
        window.location.href = 'index.html';
    } else {
        errorMessage.textContent = 'Invalid username or password';
    }
}); 
