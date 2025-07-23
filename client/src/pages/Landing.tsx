import { Button } from '@/components/ui/button';
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
  IonList,
  IonItem,
  IonLabel
} from '@ionic/react';
import { 
  logoGoogle, 
  school, 
  calendar, 
  restaurant, 
  chatbubbles, 
  people, 
  notifications,
  shield,
  checkmarkCircle
} from 'ionicons/icons';

export default function Landing() {
  const handleGoogleLogin = () => {
    window.location.href = '/api/login';
  };

  return (
    <IonPage>
      <IonContent style={{ '--background': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        
        {/* Hero Section */}
        <div className="relative h-80 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-cover bg-center opacity-20"
            style={{
              backgroundImage: 'url(https://images.unsplash.com/photo-1562774053-701939374585?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600)'
            }}
          />
          <div className="relative text-center text-white z-10">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-white bg-opacity-20 rounded-3xl backdrop-blur-sm mb-6">
              <IonIcon icon={school} style={{ fontSize: '3rem', color: 'white' }} />
            </div>
            <h1 className="text-4xl font-bold mb-3">Campus Connect</h1>
            <IonText color="light">
              <p className="text-xl opacity-90">Your University, Connected</p>
            </IonText>
          </div>
        </div>

        <div className="px-4 pb-8">
          <IonGrid>
            <IonRow className="ion-justify-content-center">
              <IonCol size="12" sizeMd="8" sizeLg="6">
                
                {/* Login Card */}
                <IonCard className="ion-no-margin mb-6">
                  <IonCardHeader className="text-center">
                    <IonCardTitle className="text-large font-semibold">Welcome Back</IonCardTitle>
                    <IonCardSubtitle className="text-small mt-2">
                      Sign in with your institutional Google account
                    </IonCardSubtitle>
                  </IonCardHeader>

                  <IonCardContent>
                    <IonButton
                      expand="block"
                      size="large"
                      onClick={handleGoogleLogin}
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
                      Continue with Google
                    </IonButton>
                  </IonCardContent>
                </IonCard>

                {/* Features Grid */}
                <IonCard className="ion-no-margin mb-6">
                  <IonCardHeader>
                    <IonCardTitle className="text-center text-medium">What's Inside</IonCardTitle>
                  </IonCardHeader>
                  <IonCardContent>
                    <IonGrid>
                      <IonRow>
                        <IonCol size="6">
                          <div className="text-center p-4 bg-blue-50 rounded-lg">
                            <IonIcon icon={notifications} style={{ fontSize: '2rem', color: '#3b82f6', marginBottom: '8px' }} />
                            <IonText>
                              <p className="text-small font-medium">Announcements</p>
                            </IonText>
                          </div>
                        </IonCol>
                        <IonCol size="6">
                          <div className="text-center p-4 bg-green-50 rounded-lg">
                            <IonIcon icon={calendar} style={{ fontSize: '2rem', color: '#22c55e', marginBottom: '8px' }} />
                            <IonText>
                              <p className="text-small font-medium">Events</p>
                            </IonText>
                          </div>
                        </IonCol>
                        <IonCol size="6">
                          <div className="text-center p-4 bg-orange-50 rounded-lg">
                            <IonIcon icon={restaurant} style={{ fontSize: '2rem', color: '#f97316', marginBottom: '8px' }} />
                            <IonText>
                              <p className="text-small font-medium">Dining</p>
                            </IonText>
                          </div>
                        </IonCol>
                        <IonCol size="6">
                          <div className="text-center p-4 bg-purple-50 rounded-lg">
                            <IonIcon icon={chatbubbles} style={{ fontSize: '2rem', color: '#a855f7', marginBottom: '8px' }} />
                            <IonText>
                              <p className="text-small font-medium">Community</p>
                            </IonText>
                          </div>
                        </IonCol>
                      </IonRow>
                    </IonGrid>
                  </IonCardContent>
                </IonCard>

                {/* Security Notice */}
                <IonCard className="ion-no-margin">
                  <IonCardContent>
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <IonIcon icon={shield} style={{ fontSize: '1.5rem', color: '#3b82f6' }} />
                      </div>
                      <div>
                        <IonText>
                          <p className="text-small">
                            <strong>Secure Access:</strong> Protected by Auth0 with institutional Google accounts only
                          </p>
                        </IonText>
                      </div>
                    </div>
                  </IonCardContent>
                </IonCard>

              </IonCol>
            </IonRow>
          </IonGrid>
        </div>
      </IonContent>
    </IonPage>
  );
}
