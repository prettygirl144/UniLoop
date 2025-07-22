import { Button } from '@/components/ui/button';

export default function Landing() {
  const handleGoogleLogin = () => {
    window.location.href = '/api/login';
  };

  return (
    <div className="max-w-sm mx-auto bg-surface min-h-screen shadow-2xl">
      {/* Hero Section */}
      <div className="h-64 bg-gradient-to-br from-primary to-blue-800 relative overflow-hidden">
        <img 
          src="https://images.unsplash.com/photo-1562774053-701939374585?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600"
          alt="Modern university campus with students" 
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-white">
            <div className="w-20 h-20 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
              <i className="fas fa-graduation-cap text-large"></i>
            </div>
            <h1 className="text-large mb-2">Campus Connect</h1>
            <p className="text-small opacity-90">Your University, Connected</p>
          </div>
        </div>
      </div>

      {/* Login Form */}
      <div className="p-6 space-y-6">
        <div className="text-center">
          <h2 className="text-large mb-2">Welcome Back</h2>
          <p className="text-text-secondary text-small">Sign in with your institutional email</p>
        </div>

        {/* Google OAuth Button */}
        <Button
          onClick={handleGoogleLogin}
          className="w-full bg-surface border-2 border-gray-200 rounded-lg p-4 flex items-center justify-center space-x-3 hover:bg-gray-50 transition-colors text-foreground"
          variant="outline"
        >
          <i className="fab fa-google text-medium text-red-500"></i>
          <span className="text-medium">Continue with Google</span>
        </Button>

        {/* Features Preview */}
        <div className="space-y-3 pt-4">
          <div className="flex items-center space-x-3 text-small text-text-secondary">
            <i className="fas fa-bullhorn w-5"></i>
            <span>Stay updated with campus announcements</span>
          </div>
          <div className="flex items-center space-x-3 text-small text-text-secondary">
            <i className="fas fa-calendar-alt w-5"></i>
            <span>Never miss important events</span>
          </div>
          <div className="flex items-center space-x-3 text-small text-text-secondary">
            <i className="fas fa-users w-5"></i>
            <span>Connect with fellow students</span>
          </div>
        </div>
      </div>
    </div>
  );
}
