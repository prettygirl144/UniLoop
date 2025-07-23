import { useAuth0 } from '@auth0/auth0-react';
import { useEffect } from 'react';
import { 
  IonPage, 
  IonContent, 
  IonCard, 
  IonCardHeader, 
  IonCardTitle, 
  IonCardSubtitle, 
  IonCardContent, 
  IonIcon,
  IonText,
  IonGrid,
  IonRow,
  IonCol,
  IonSpinner
} from '@ionic/react';
import { logOut, checkmarkCircle } from 'ionicons/icons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut } from 'lucide-react';

export default function Auth0Logout() {
  const { logout } = useAuth0();

  useEffect(() => {
    logout({
      logoutParams: {
        returnTo: window.location.origin
      }
    });
  }, [logout]);

  return (
    <IonPage>
      <IonContent className="ion-padding" style={{ '--background': 'linear-gradient(135deg, #ff7e5f 0%, #feb47b 100%)' }}>
        <IonGrid className="h-full">
          <IonRow className="ion-justify-content-center ion-align-items-center h-full">
            <IonCol size="12" sizeMd="6" sizeLg="4">
              
              <IonCard className="ion-no-margin">
                <IonCardHeader className="text-center pb-2">
                  <div className="flex justify-center mb-4">
                    <div className="p-4 rounded-full bg-orange-50">
                      <IonIcon icon={logOut} style={{ fontSize: '2.5rem', color: '#f97316' }} />
                    </div>
                  </div>
                  <IonCardTitle className="text-large font-semibold">Signing Out</IonCardTitle>
                  <IonCardSubtitle className="text-small mt-2">
                    Please wait while we securely sign you out of Campus Connect
                  </IonCardSubtitle>
                </IonCardHeader>

                <IonCardContent className="text-center">
                  {/* Loading Spinner */}
                  <div className="flex justify-center mb-6">
                    <IonSpinner 
                      name="crescent" 
                      style={{ 
                        width: '3rem', 
                        height: '3rem',
                        '--color': '#f97316'
                      }} 
                    />
                  </div>

                  {/* Status Messages */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-center space-x-2">
                      <IonIcon icon={checkmarkCircle} style={{ color: '#22c55e' }} />
                      <IonText color="success">
                        <span className="text-small">Session cleared</span>
                      </IonText>
                    </div>
                    
                    <IonText color="medium">
                      <p className="text-small">
                        You will be redirected to the login page shortly.
                      </p>
                    </IonText>
                  </div>

                  {/* Security Note */}
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <IonText color="medium">
                      <p className="text-small">
                        <strong>Security Notice:</strong> All session data has been securely cleared from this device.
                      </p>
                    </IonText>
                  </div>
                </IonCardContent>
              </IonCard>

            </IonCol>
          </IonRow>
        </IonGrid>
      </IonContent>
    </IonPage>
  );
}