'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRobot, faPlus, faSearch } from '@fortawesome/free-solid-svg-icons';
//import Image from 'next/image';
import ConversationListcomponent from './components/agentManager/conversationListComponent';
import IDEComponent from './components/ide/IDEComponent';

import { AuthProvider } from './components/general/auth-provider';
import Header from './components/general/header';
import Footer from './components/general/footer';
import TicketComponent from './components/ticketManager/ticketComponent';

interface FeatureCardProps {
  icon: JSX.Element; // Define type for icon prop
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="feature-card">
      <div className="feature-card-icon">{icon}</div>
      <h2 className="feature-card-title">{title}</h2>
      <p className="feature-card-description">{description}</p>
    </div>
  );
}



export default function Home() {
  return (
    <AuthProvider>
      <div className="app-container">
        <Header /> {/* Ensure Header component has no external margins */}
        <main className="app-main">
          <div className="content-row"> {/* Full height for main content */}
            <aside className="sidebar">
              {/* Sidebar content */}
            </aside>
            <div className="main-content"> {/* Central content padding */}
              {/* Central content */}
              <div className="text-center">
                <h1 className="title">
                  {/* Welcome to AI Assistant */}
                </h1>
                <p className="description">
                  {/* Your intelligent companion for assistance and productivity. */}
                </p>
              </div>
              <div className="grid-layout">
                <FeatureCard
                  icon={<FontAwesomeIcon icon={faRobot} />}
                  title="Intelligent Responses"
                  description="Get quick and accurate responses to your queries."
                />
                <FeatureCard
                  icon={<FontAwesomeIcon icon={faRobot} />}
                  title="Personalized Assistance"
                  description="Tailored assistance to meet your specific needs and preferences."
                />
                <FeatureCard
                  icon={<FontAwesomeIcon icon={faRobot} />}
                  title="24/7 Availability"
                  description="Available round the clock to assist you whenever you need."
                />
                <FeatureCard
                  icon={<FontAwesomeIcon icon={faRobot} />}
                  title="Seamless Integration"
                  description="Integrate with your favorite apps and services effortlessly."
                />
              </div>
              
              {/* Ticket Section */}
              <section>
                <h2 className="section-header">Tasks</h2>
                <TicketComponent />
              </section>

              {/* Assistant Section */}
              <section>
                <h2 className="section-header">Agents</h2>
                <ConversationListcomponent />
              </section>

               {/* IDE Section */}
              <section>
                <IDEComponent />
              </section>
            </div>
          </div>
        </main>
        <Footer /> {/* Ensure Footer component has no external margins */}
      </div>
    </AuthProvider>
  );
}

