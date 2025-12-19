import { Box, SpaceBetween, ColumnLayout, Container, Header } from "@cloudscape-design/components";
import { Link, StatusIndicator } from "@cloudscape-design/components";
import { useState, useEffect } from 'react';
import Cards from "@cloudscape-design/components/cards";
import { getVisitDataByCategory, AIVisit } from "../services/visitService";
import Button from '@cloudscape-design/components/button'
import {useTranslation} from 'react-i18next';

interface PatientStep3Props {
  sessionId: string | null;
}

interface Specialist {
  id: number;
  title: string;
  status: "Recommendations generated" | "No recommendations" | "Loading...";
  icon: string;
  dataCategory: string;
}

interface SpecialistCardProps {
  title: string;
  status: Specialist['status'];
  icon: string;
}

interface SpecialistDetails {
  title: string;
  recommendations: string[];
}

// Array of specialist data
const specialistData: Specialist[] = [
  {
    id: 1,
    title: "Certified Diabetes Care and Education Specialist",
    status: "Loading...",
    icon: "🏥",
    dataCategory: "diabetesExpert"

  },
  {
    id: 2,
    title: "Allergies Expert",
    status: "Loading...",
    icon: "🦠",
    dataCategory: "allergiesExpert"
  },
  {
    id: 3,
    title: "National Kidney Foundation Expert",
    status: "Loading...",
    icon: "🔬",
    dataCategory: "kidneyExpert"
  },
  {
    id: 4,
    title: "Insurance Expert",
    status: "Loading...",
    icon: "👨‍💼",
    dataCategory: "insurnaceExpert"
  },
  {
    id: 5,
    title: "Registered Dietitian Nutritionist (RDN)",
    status: "Loading...",
    icon: "🥗",
    dataCategory: "nutritionExpert"
  },
  {
    id: 6,
    title: "Ophthalmologist Expert",
    status: "Loading...",
    icon: "👓",
    dataCategory: "ophthalmologistExpert"
  },
  {
    id: 7,
    title: "Podiatrist Expert",
    status: "Loading...",
    icon: "🦶",
    dataCategory: "podiatristExpert"
  },
  {
    id: 8,
    title: "Hospital Care Team",
    status: "Loading...",
    icon: "🧑‍⚕️",
    dataCategory: "hospitalCareTeamExpert"
  },
  {
    id: 9,
    title: "American Diabetes Association (ADA) Expert",
    status: "Loading...",
    icon: "👩‍⚕️",
    dataCategory: "adaExpert"
  },
  {
    id: 10,
    title: "Social Determinants of Health Expert",
    status: "Loading...",
    icon: "👥",
    dataCategory: "socialDeterminantsExpert"
  },
  {
    id: 11,
    title: "Physical Therapist Expert",
    status: "Loading...",
    icon: "🏃‍➡️",
    dataCategory: "physicalTherapistExpert"
  },
  {
    id: 12,
    title: "Pharmacist Expert",
    status: "Loading...",
    icon: "💊",
    dataCategory: "pharmacistExpert"
  }
];

interface CarePlan {
  diagnosticTests: string[];
  followUpRecommendations: string[];
  patientEducation: string[];
  specialistReferrals: string[];
  treatmentOptions: string[];
}


// Main Page Component
const SpecialistsPage: React.FC<PatientStep3Props> = ({ sessionId }) => {
  const [specialists, setSpecialists] = useState<Specialist[]>(specialistData);
  const [selectedSpecialist, setSelectedSpecialist] = useState<SpecialistDetails | null>(null);
  const [carePlan, setCarePlan] = useState<CarePlan | null>(null);
  const [isLoadingCarePlan, setIsLoadingCarePlan] = useState(true);
  const [carePlanError, setCarePlanError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 20;
  const retryInterval = 5000; // 3 seconds
  const [carePlanRetryCount, setCarePlanRetryCount] = useState(0);
  const [visitDataRetryCount, setVisitDataRetryCount] = useState(0);
  const { t } = useTranslation();

 
  const fetchCarePlanData = async () => {
    if (!sessionId) {
      setCarePlanError("No session ID available");
      setIsLoadingCarePlan(false);
      return;
    }

    try {
      setIsLoadingCarePlan(true);
      setCarePlanError(null);
      console.log("session ID", sessionId);
      const visitData = await getVisitDataByCategory(sessionId);
      console.log("Visit Data", visitData);
      // Find the care plan data
      const carePlanData = visitData.find(item => item.dataCategory === 'carePlan');
      console.log("Care Plan", carePlanData);
      if (!carePlanData || !carePlanData.diagnosticTests) {
        throw new Error("Care plan data not fully processed yet");
      }

      setCarePlan({
        diagnosticTests: carePlanData.diagnosticTests ? JSON.parse(carePlanData.diagnosticTests) : '',
        followUpRecommendations: carePlanData.followUpRecommendations ? JSON.parse(carePlanData.followUpRecommendations) : '',
        patientEducation: carePlanData.patientEducation ? JSON.parse(carePlanData.patientEducation) : '',
        specialistReferrals: carePlanData.specialistReferrals ? JSON.parse(carePlanData.specialistReferrals) : '',
        treatmentOptions: carePlanData.treatmentOptions ? JSON.parse(carePlanData.treatmentOptions) : ''
      });
      setCarePlanRetryCount(0); // Reset retry count on success
      setIsLoadingCarePlan(false);
    } catch (err) {
      console.error("Error fetching care plan:", err);
      if (carePlanRetryCount < maxRetries) {
        setCarePlanRetryCount(prev => prev + 1);
        setTimeout(() => fetchCarePlanData(), retryInterval);
      } else {
        setCarePlanError("Failed to fetch care plan data after multiple attempts");
      }
    } finally {
      if (carePlanRetryCount >= maxRetries) {
        setIsLoadingCarePlan(false);
      }
    }
  };

  const fetchVisitData = async () => {
    if (!sessionId) {
      setError("No session ID available");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const visitData = await getVisitDataByCategory(sessionId);
      
      // Check if we have any expert recommendations
      const hasAnyExpertData = visitData.some(item => 
        item.expertResult && item.expertResult.length > 0
      );

      if (!hasAnyExpertData) {
        throw new Error("Expert recommendations not fully processed yet");
      }

      // Create a Set of categories that have data
      const categoriesWithData = new Set(visitData.map(item => item.dataCategory));
      
      // Update specialists with their status based on data presence
      const updatedSpecialists = specialists.map(specialist => ({
        ...specialist,
        status: categoriesWithData.has(specialist.dataCategory) 
          ? "Recommendations generated" 
          : "No recommendations"
      }));
      
      setSpecialists(updatedSpecialists);
      setVisitDataRetryCount(0); // Reset retry count on success
    } catch (err) {
      console.error("Error fetching visit data:", err);
      if (visitDataRetryCount < maxRetries) {
        setVisitDataRetryCount(prev => prev + 1);
        setTimeout(() => fetchVisitData(), retryInterval);
      } else {
        setError("Failed to fetch specialist recommendations after multiple attempts");
      }
    } finally {
      if (visitDataRetryCount >= maxRetries) {
        setIsLoading(false);
      }
    }
  };




  const handleCardClick = async (specialist: Specialist) => {
    if (!sessionId) {
      console.error("No session ID available");
      return;
    }

    try {
      const visitData = await getVisitDataByCategory(sessionId); // Use sessionId instead of hardcoded value
      
      // Find the data for the selected specialist using their dataCategory
      const specialistData = visitData.find(item => item.dataCategory === specialist.dataCategory);
      if (specialistData && specialistData.expertResult) {
        setSelectedSpecialist({
          title: specialist.title,
          recommendations: [specialistData.expertResult]
        });
      } else {
        setSelectedSpecialist({
          title: specialist.title,
          recommendations: ["No recommendations available for this specialist"]
        });
      }
    } catch (error) {
      console.error("Error fetching specialist recommendations:", error);
      setSelectedSpecialist({
        title: specialist.title,
        recommendations: ["Error loading recommendations"]
      });
    }
  };


  // Individual Specialist Card Component
  const SpecialistCard: React.FC<SpecialistCardProps & {
    onClick: () => void;
  }> = ({ title, status, icon, onClick }) => {
    const getStatusType = (status: string) => {
      switch (status) {
        case "Recommendations generated":
          return "success";
        case "No recommendations":
          return "error";
        default:
          return "pending";
      }
    };

    const handleLinkClick = (e: React.MouseEvent) => {
      e.preventDefault();
      onClick(); // Call the same onClick handler that's used for the card
    };

    const cardStyle: React.CSSProperties = {
      cursor: 'pointer',
      opacity: status === "No recommendations" ? 0.5 : 1,
      backgroundColor: status === "No recommendations" ? "#f2f2f2" : "transparent",
    };
    
    return (
      <Box padding="s" onClick={onClick} style={cardStyle }>
        <SpaceBetween size="s">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span>{icon}</span>
            <span>{title}</span>
          </div>
          <StatusIndicator type={getStatusType(status)}>
            {status}
          </StatusIndicator>
          <Link 
          href="#" 
          onFollow={(e) => handleLinkClick(e as unknown as React.MouseEvent)}
        >{t("session.actions.seeFullDetails")}</Link>
        </SpaceBetween>
      </Box>
    );
  };

  if (!sessionId) {
    return (
      <Container>
        <Box>{t("session.errors.noSessionID")}</Box>
      </Container>
    );
  }

  const handleRefresh = async () => {
    console.log("Refresh clicked");
    setIsRefreshing(true);
    setRetryCount(0); // Reset retry count
    setError(null);
    setCarePlanError(null);
    setCarePlan(null);
    setCarePlanRetryCount(0);
    setVisitDataRetryCount(0);
    setSelectedSpecialist(null);
    
    try {
      // Start both fetches simultaneously
      await Promise.all([
        fetchCarePlanData(),
        fetchVisitData()
      ]);

      // Clear selected specialist to force UI refresh
      //setSelectedSpecialist(null);
    } catch (err) {
      console.error("Error refreshing data:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (sessionId) {
      fetchCarePlanData();
      fetchVisitData();
    }
  }, [sessionId]);

  return (

    <SpaceBetween size="s">

      {error ? (
        <Box>{error}</Box>
      ) : (
        <Cards
          items={specialists}
          ariaLabels={{
            itemSelectionLabel: (e, n) => `select ${n.title}`,
            selectionGroupLabel: "Specialist selection"
          }}
          cardDefinition={{
            header: (item: Specialist) => (
              <SpecialistCard
                title={item.title}
                status={item.status}
                icon={item.icon}
                onClick={() => handleCardClick(item)}
              />
            )
          }}
          columnsPerRow={[
            { cards: 4 },
            { minWidth: 100, cards: 4 }
          ]}
          variant="full-page"
        />
      )}

        <Button 
            onClick={handleRefresh}
            loading={isRefreshing}
            disabled={isRefreshing}
            iconName="refresh">
            {t("ui.buttons.refresh")}
            
        </Button>


        <ColumnLayout columns={2}>
          {/* Left Column - Care Plan */}
          <Container
            header={
              <Header variant="h2">
                {t("medical.careplan.suggested")}
              </Header>
            }
          >
            {isLoadingCarePlan ? (
              <Box>{t("session.loading.loadingCarePlan")}.</Box>
            ) : carePlanError ? (
              <Box>{carePlanError}</Box>
            ) : carePlan ? (
              <SpaceBetween size="m">
                <Container
                  header={
                    <Header variant="h3">{t("medical.careplan.diagnosticTests")}</Header>
                  }
                >
                  <ul>
                    {carePlan.diagnosticTests ? (
                      <li>{carePlan.diagnosticTests}</li>
                    ) : (
                      <li>{t("medical.careplan.noDiagnosticTests")}</li>
                    )}
                  </ul>
                </Container>

                <Container
                  header={
                    <Header variant="h3">{t("medical.careplan.followUpRecommendations")}</Header>
                  }
                >
                  <ul>
                    {carePlan.followUpRecommendations ? (
                      <li>{carePlan.followUpRecommendations}</li>
                    ) : (
                      <li>{t("medical.careplan.noFollowUpRecommendations")}</li>
                    )}
                  </ul>
                </Container>

                <Container
                  header={
                    <Header variant="h3">{t("medical.careplan.patientEducation")}</Header>
                  }
                >
                  <ul>
                      {carePlan.patientEducation ? (
                        <li>{carePlan.patientEducation}</li>
                      ) : (
                        <li>{t("medical.careplan.noPatientEducation")}</li>
                      )}
                    </ul>
                </Container>

                <Container
                  header={
                    <Header variant="h3">{t("medical.careplan.specialistReferrals")}</Header>
                  }
                >
                  <ul>
                    {carePlan.specialistReferrals ? (
                      <li>{carePlan.specialistReferrals}</li>
                    ) : (
                      <li>{t("medical.careplan.noSpecialistReferrals")}</li>
                    )}
                  </ul>
                </Container>

                <Container
                  header={
                    <Header variant="h3">{t("medical.careplan.treatmentOptions")}</Header>
                  }
                >
                  <ul>
                    {carePlan.treatmentOptions ? (
                      <li>{carePlan.treatmentOptions}</li>
                    ) : (
                      <li>{t("medical.careplan.noTreatmentOptions")}</li>
                    )}
                  </ul>
                </Container>
              </SpaceBetween>
            ) : (
              <Box>{t("medical.careplan.noCarePlan")}</Box>
            )}
          </Container>

          {/* Right Column - Specialist Details */}
          <Container
            header={
              <Header variant="h2">
                {t("medical.careplan.specialistRecommendations")}
              </Header>
            }
          >
            {selectedSpecialist ? (
              <SpaceBetween size="m">
                <Header variant="h3">{selectedSpecialist.title}</Header>
                <Box>
                  <h4>{t("medical.careplan.recommendations")}:</h4>
                  <ul>
                    {selectedSpecialist.recommendations}
                  </ul>
                </Box>
              </SpaceBetween>
            ) : (
              <Box>{t("medical.careplan.selectCard")}</Box>
            )}
          </Container>
        </ColumnLayout>
      </SpaceBetween>
  );
};

export default SpecialistsPage;