import { useAuth0 } from '@auth0/auth0-react';
import { 
  IonPage, 
  IonContent, 
  IonCard, 
  IonCardHeader, 
  IonCardTitle, 
  IonCardSubtitle, 
  IonCardContent, 
  IonButton, 
  IonIcon,
  IonText,
  IonGrid,
  IonRow,
  IonCol,
  IonChip,
  IonProgressBar
} from '@ionic/react';
import { logoGoogle, shieldCheckmark, school, lockClosed } from 'ionicons/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogIn, Shield } from 'lucide-react';

export default function Auth0Login() {
  const { loginWithRedirect, isLoading } = useAuth0();

  const handleLogin = () => {
    loginWithRedirect({
      authorizationParams: {
        connection: 'google-oauth2', // Force Google login only
        prompt: 'login',
      }
    });
  };

  return (
    <IonPage>
      <IonContent className="ion-padding" style={{ '--background': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <IonGrid className="h-full">
          <IonRow className="ion-justify-content-center ion-align-items-center h-full">
            <IonCol size="12" sizeMd="6" sizeLg="4">
              
              {/* Campus Connect Logo Section */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-white bg-opacity-20 rounded-3xl backdrop-blur-sm mb-4">
                  <IonIcon icon={school} style={{ fontSize: '2.5rem', color: 'white' }} />
                </div>
                <h1 className="text-3xl font-bold text-white mb-2">Campus Connect</h1>
                <IonText color="light">
                  <p className="text-lg opacity-90">Your University, Connected</p>
                </IonText>
              </div>

              {/* Main Login Card */}
              <IonCard className="ion-no-margin">
                <IonCardHeader className="text-center pb-2">
                  <div className="flex justify-center mb-4">
                    <div className="p-3 rounded-full bg-blue-50">
                      <IonIcon icon={shieldCheckmark} style={{ fontSize: '2rem', color: '#3b82f6' }} />
                    </div>
                  </div>
                  <IonCardTitle className="text-large font-semibold">Welcome Back</IonCardTitle>
                  <IonCardSubtitle className="text-small mt-2">
                    Sign in with your institutional Google account to access the campus management system
                  </IonCardSubtitle>
                </IonCardHeader>

                <IonCardContent>
                  {/* Loading Progress */}
                  {isLoading && (
                    <IonProgressBar type="indeterminate" className="mb-4" />
                  )}

                  {/* Google Sign In Button */}
                  <IonButton
                    expand="block"
                    size="large"
                    onClick={handleLogin}
                    disabled={isLoading}
                    className="mb-4"
                    style={{
                      '--background': '#4285f4',
                      '--background-hover': '#357ae8',
                      '--background-activated': '#357ae8',
                      '--color': 'white',
                      '--border-radius': '12px',
                      height: '56px'
                    }}
                  >
                    <IonIcon icon={logoGoogle} slot="start" />
                    {isLoading ? 'Signing you in...' : 'Continue with Google'}
                  </IonButton>

                  {/* Features Preview */}
                  <div className="space-y-3 mt-6">
                    <div className="flex items-center space-x-3 text-small">
                      <IonChip color="primary" outline>
                        <IonIcon icon={lockClosed} />
                        <span>Secure Auth</span>
                      </IonChip>
                      <IonText color="medium">Powered by Auth0</IonText>
                    </div>
                  </div>

                  {/* Security Notice */}
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <IonText color="medium">
                      <p className="text-small text-center">
                        <strong>Secure Access:</strong> Only institutional Google accounts are supported for enhanced security.
                      </p>
                    </IonText>
                  </div>
                </IonCardContent>
              </IonCard>

              {/* Footer Features */}
              <div className="mt-6 text-center">
                <IonText color="light">
                  <p className="text-small opacity-80">
                    Access announcements, events, dining services, and more
                  </p>
                </IonText>
              </div>

            </IonCol>
          </IonRow>
        </IonGrid>
      </IonContent>
    </IonPage>
  );
}