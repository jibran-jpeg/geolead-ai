#!/bin/bash

# GeoLead AI - Setup and Installation Script
# This script helps users set up the GeoLead AI Chrome extension quickly

set -e

echo "🚀 Setting up GeoLead AI - Production-Grade Google Maps Scraper"
echo "=================================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
check_nodejs() {
    print_status "Checking Node.js installation..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version | cut -d'v' -f2)
        print_success "Node.js v$NODE_VERSION found"
        
        # Check if version is >= 16
        if [ "$(printf '%s\n' "16.0.0" "$NODE_VERSION" | sort -V | head -n1)" = "16.0.0" ]; then
            print_success "Node.js version is compatible"
        else
            print_error "Node.js version must be >= 16.0.0"
            exit 1
        fi
    else
        print_error "Node.js is not installed. Please install Node.js >= 16.0.0"
        exit 1
    fi
}

# Check if npm is installed
check_npm() {
    print_status "Checking npm installation..."
    
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        print_success "npm v$NPM_VERSION found"
    else
        print_error "npm is not installed. Please install npm"
        exit 1
    fi
}

# Check if Chrome is installed
check_chrome() {
    print_status "Checking Chrome installation..."
    
    if command -v google-chrome &> /dev/null || command -v chromium &> /dev/null || command -v chrome &> /dev/null; then
        print_success "Chrome/Chromium found"
    else
        print_warning "Chrome/Chromium not found in PATH. Please ensure Chrome is installed"
    fi
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    if [ -d "node_modules" ]; then
        print_warning "node_modules already exists. Running npm install to ensure everything is up to date..."
        npm install
    else
        npm install
    fi
    
    if [ $? -eq 0 ]; then
        print_success "Dependencies installed successfully"
    else
        print_error "Failed to install dependencies"
        exit 1
    fi
}

# Build the extension
build_extension() {
    print_status "Building the extension..."
    
    if command -v vite &> /dev/null; then
        npm run build
        if [ $? -eq 0 ]; then
            print_success "Extension built successfully"
        else
            print_error "Failed to build extension"
            exit 1
        fi
    else
        print_error "Vite not found. Please run 'npm install' first"
        exit 1
    fi
}

# Create necessary directories
create_directories() {
    print_status "Creating necessary directories..."
    
    mkdir -p assets
    mkdir -p dist
    
    # Create placeholder icons if they don't exist
    if [ ! -f "assets/icon-16.png" ]; then
        print_warning "Extension icons not found. Creating placeholder icons..."
        # This is a simplified approach - in production, you'd have proper icon files
        echo "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4QgZDhMvKzJp4AAAAB1pVFh0Q29tbWVudAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoV2luZG93cykiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6RkZEMTg2N0Y2Q0JFMTFFN0JFNDk5N0ZBMjE2MzgwRjAiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6RkZEMTg2NzA2Q0JFMTFFN0JFNDk5N0ZBMjE2MzgwRjAiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDpGREA4ODY3RDZCQkUxMUU3QkU0OTk3RkEyMTYzODBGMCIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDpGREA4ODY3N0JGQkUxMUU3QkU0OTk3RkEyMTYzODBGMCIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PgH//v38+/r5+Pf29fTz8vHw7+7t7Ovq6ejn5uXk4+Lh4N/e3dzb2tnY19bV1NPS0dDPzs3My8rJyMfGxcTDwsHAv769vLu6ubi3trW0s7KxsK+urayrqqmop6alpKOioaCfnp2cm5qZmJeWlZSTkpGQj46NjIuKiYiHhoWEg4KBgH9+fXx7enl4d3Z1dHNycXBvbm1sa2ppaGdmZWRjYmFgX15dXFtaWVhXVlVUU1JRUE9OTUxLSklIR0ZFRENCQUA/Pj08Ozo5ODc2NTQzMjEwLy4tLCsqKSgnJiUkIyIhIB8eHRwbGhkYFxYVFBMSERAPDg0MCwoJCAcGBQQDAgEAACH5BAEAAAAALAAAAAAEAAQAAAIdhI+py+0Po5y02ouzPgUAOw==" | base64 -d > assets/icon-16.png
    fi
    
    if [ ! -f "assets/icon-48.png" ]; then
        echo "iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4QgZDhMvKzJp4AAAAB1pVFh0Q29tbWVudAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoV2luZG93cykiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6RkZEMTg2N0Y2Q0JFMTFFN0JFNDk5N0ZBMjE2MzgwRjAiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6RkZEMTg2NzA2Q0JFMTFFN0JFNDk5N0ZBMjE2MzgwRjAiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDpGREA4ODY3RDZCQkUxMUU3QkU0OTk3RkEyMTYzODBGMCIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDpGREA4ODY3N0JGQkUxMUU3QkU0OTk3RkEyMTYzODBGMCIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PgH//v38+/r5+Pf29fTz8vHw7+7t7Ovq6ejn5uXk4+Lh4N/e3dzb2tnY19bV1NPS0dDPzs3My8rJyMfGxcTDwsHAv769vLu6ubi3trW0s7KxsK+urayrqqmop6alpKOioaCfnp2cm5qZmJeWlZSTkpGQj46NjIuKiYiHhoWEg4KBgH9+fXx7enl4d3Z1dHNycXBvbm1sa2ppaGdmZWRjYmFgX15dXFtaWVhXVlVUU1JRUE9OTUxLSklIR0ZFRENCQUA/Pj08Ozo5ODc2NTQzMjEwLy4tLCsqKSgnJiUkIyIhIB8eHRwbGhkYFxYVFBMSERAPDg0MCwoJCAcGBQQDAgEAACH5BAEAAAAALAAAAAAEAAQAAAIdhI+py+0Po5y02ouzPgUAOw==" | base64 -d > assets/icon-48.png
    fi
    
    if [ ! -f "assets/icon-128.png" ]; then
        echo "iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4QgZDhMvKzJp4AAAAB1pVFh0Q29tbWVudAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoV2luZG93cykiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6RkZEMTg2N0Y2Q0JFMTFFN0JFNDk5N0ZBMjE2MzgwRjAiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6RkZEMTg2NzA2Q0JFMTFFN0JFNDk5N0ZBMjE2MzgwRjAiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDpGREA4ODY3RDZCQkUxMUU3QkU0OTk3RkEyMTYzODBGMCIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDpGREA4ODY3N0JGQkUxMUU3QkU0OTk3RkEyMTYzODBGMCIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PgH//v38+/r5+Pf29fTz8vHw7+7t7Ovq6ejn5uXk4+Lh4N/e3dzb2tnY19bV1NPS0dDPzs3My8rJyMfGxcTDwsHAv769vLu6ubi3trW0s7KxsK+urayrqqmop6alpKOioaCfnp2cm5qZmJeWlZSTkpGQj46NjIuKiYiHhoWEg4KBgH9+fXx7enl4d3Z1dHNycXBvbm1sa2ppaGdmZWRjYmFgX15dXFtaWVhXVlVUU1JRUE9OTUxLSklIR0ZFRENCQUA/Pj08Ozo5ODc2NTQzMjEwLy4tLCsqKSgnJiUkIyIhIB8eHRwbGhkYFxYVFBMSERAPDg0MCwoJCAcGBQQDAgEAACH5BAEAAAAALAAAAAAEAAQAAAIdhI+py+0Po5y02ouzPgUAOw==" | base64 -d > assets/icon-128.png
    fi
    
    print_success "Directories and placeholder icons created"
}

# Run tests
run_tests() {
    print_status "Running tests..."
    
    if [ -f "package.json" ] && command -v jest &> /dev/null; then
        npm test
        if [ $? -eq 0 ]; then
            print_success "All tests passed"
        else
            print_error "Some tests failed"
            exit 1
        fi
    else
        print_warning "Tests not available or Jest not installed"
    fi
}

# Create desktop shortcut (Linux/macOS)
create_desktop_shortcut() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        print_status "Creating desktop shortcut for Linux..."
        
        cat > ~/Desktop/GeoLead_AI.desktop << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=GeoLead AI
Comment=Production-grade Google Maps scraper
Exec=google-chrome --load-extension=$(pwd)/dist
Icon=$(pwd)/assets/icon-128.png
Terminal=false
Categories=Development;Web;
EOF
        
        chmod +x ~/Desktop/GeoLead_AI.desktop
        print_success "Desktop shortcut created"
        
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        print_status "Creating desktop shortcut for macOS..."
        
        cat > ~/Desktop/GeoLead_AI.command << EOF
#!/bin/bash
open -a "Google Chrome" --args --load-extension=$(pwd)/dist
EOF
        
        chmod +x ~/Desktop/GeoLead_AI.command
        print_success "Desktop shortcut created"
    fi
}

# Display usage instructions
display_instructions() {
    print_success "Setup completed successfully!"
    echo ""
    echo "📋 Next Steps:"
    echo "============"
    echo ""
    echo "1. 🌐 Load the extension in Chrome:"
    echo "   - Open Chrome and navigate to chrome://extensions/"
    echo "   - Enable 'Developer mode' (toggle in top right)"
    echo "   - Click 'Load unpacked' and select the 'dist' folder"
    echo ""
    echo "2. 🧪 Test the extension:"
    echo "   - Navigate to Google Maps"
    echo "   - Search for businesses (e.g., 'restaurants in Lahore')"
    echo "   - Click the GeoLead AI extension icon"
    echo "   - Configure your preferences and start scraping"
    echo ""
    echo "3. 📊 Run the demo:"
    echo "   - Run 'npm run demo' to see a demonstration"
    echo "   - This will show the scraper's capabilities"
    echo ""
    echo "4. 🔧 Configuration:"
    echo "   - All settings are saved in Chrome storage"
    echo "   - Customize scraping preferences in the popup"
    echo "   - Export data in CSV, Excel, or JSON formats"
    echo ""
    echo "📚 Documentation:"
    echo "   - README.md: Complete documentation"
    echo "   - Wiki: Additional guides and tutorials"
    echo "   - Issues: Report bugs and request features"
    echo ""
    echo "🚀 Have fun extracting high-quality leads!"
}

# Main setup process
main() {
    echo ""
    
    # Check prerequisites
    check_nodejs
    check_npm
    check_chrome
    
    # Setup steps
    install_dependencies
    create_directories
    build_extension
    
    # Optional steps
    if [ "$1" = "--with-tests" ]; then
        run_tests
    fi
    
    if [ "$1" = "--with-shortcut" ]; then
        create_desktop_shortcut
    fi
    
    # Display instructions
    display_instructions
}

# Parse command line arguments
case "${1:-}" in
    --with-tests)
        main --with-tests
        ;;
    --with-shortcut)
        main --with-shortcut
        ;;
    --help|-h)
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --with-tests    Run tests after setup"
        echo "  --with-shortcut Create desktop shortcut"
        echo "  --help, -h      Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0                    # Basic setup"
        echo "  $0 --with-tests       # Setup with tests"
        echo "  $0 --with-shortcut    # Setup with desktop shortcut"
        exit 0
        ;;
    *)
        main
        ;;
esac