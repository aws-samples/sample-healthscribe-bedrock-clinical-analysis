import * as React from "react";
import { useNavigate, useParams } from 'react-router-dom';
import Wizard from "@cloudscape-design/components/wizard";
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import PatientStep1 from './PatientStep1';
import StartTranscriptionButton from '../components/StartTranscriptionButton';
import SpecialistsPage from "./PatientStep3";
import AIAlert from '../components/commons/alert'
import Modal from "@cloudscape-design/components/modal";
import Box from "@cloudscape-design/components/box";
import HCTranscript from "./PatientStep2";
import PatientStep4 from "./PatientStep4";
import { updatePatientId } from "../services/visitService";
import {useTranslation} from 'react-i18next';

export default () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { patientID } = useParams<{ patientID: string }>();
    const [activeStepIndex, setActiveStepIndex] = React.useState(0);
    const [showConfirmationModal, setShowConfirmationModal] = React.useState(false);
    const [showCancelModal, setShowCancelModal] = React.useState(false);
    const [sessionId, setSessionId] = React.useState<string | null>(null);

    const handleSessionStart = (newSessionId: string) => {
      setSessionId(newSessionId);
    };

    const handleApproval = () => {
      // Add any approval logic here
      setShowConfirmationModal(true);
    };

    const handleCancel = () => {
      setShowCancelModal(true);
    }

    const handleConfirmationClose = () => {
      setShowConfirmationModal(false);
      updatePatientId(sessionId, patientID);
      navigate(`/patient/${patientID}`);
    };

    const handleCancelClose = () => {
      setShowCancelModal(false);
      navigate(`/patient/${patientID}`);
    
    }

    const handleCancelContEditing = () => {
      setShowCancelModal(false);
    }

    const handleStartRecording = () => {
      console.log('Start recording clicked');
      StartTranscriptionButton
    };
    
    const steps=[
      {
        title: "Record Visit",
        description:"Record physician-patient conversation.",
        content: (
          <PatientStep1 
            onSessionStart={handleSessionStart}
          />
        )
      },
      {
        title: "View Insights",
        content: (
          <HCTranscript 
          sessionId={sessionId}/>
        )
      },
      {
        title: "View AI Experts",
        content: (
          <SpecialistsPage 
          sessionId={sessionId}
        />
            
        )
      },
      {
        title: "Final Review",
        content: (
          <SpaceBetween size="xs">
            <AIAlert />
              <PatientStep4 sessionId={sessionId}/>
           
          </SpaceBetween>
        )
      }
    ];

    return (
      <>
      <Wizard
        i18nStrings={{
          stepNumberLabel: stepNumber =>
            `Step ${stepNumber}`,
          collapsedStepsLabel: (stepNumber, stepsCount) =>
            `Step ${stepNumber} of ${stepsCount}`,
          skipToButtonLabel: (step, stepNumber) =>
            `Skip to ${step.title}`,
          navigationAriaLabel: "Steps",
          cancelButton: "Cancel",
          previousButton: "Previous",
          nextButton: "Next",
          optional: "optional"
        }}
        onNavigate={({ detail }) =>
          setActiveStepIndex(detail.requestedStepIndex)
        }
        activeStepIndex={activeStepIndex}
        submitButtonText="Approve and complete visit"
        onSubmit={handleApproval}
        onCancel={handleCancel}
        allowSkipTo
        steps={steps}
      />
      <Modal
          visible={showConfirmationModal}
          onDismiss={handleConfirmationClose}
          closeAriaLabel="Close modal"
          size="large"
          footer={
            <Box float="right">
              <Button
                variant="primary"
                onClick={handleConfirmationClose}
              >
                {t("ui.buttons.ok")}
              </Button>
            </Box>
          }
          header="Notes submitted"
        >
          {t("session.status.notesAdded")}
        </Modal>

        <Modal
          visible={showCancelModal}
          onDismiss={handleCancelClose}
          closeAriaLabel="Close modal"
          size="medium"
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  variant="link"
                  onClick={handleCancelContEditing}
                >
                  {t("ui.buttons.continueSession")}
                </Button>
                <Button
                  variant="primary"
                  onClick={handleCancelClose}
                >
                  {t("ui.buttons.leavePage")}
                </Button>
              </SpaceBetween>
            </Box>
          }
          header="Cancel the current visit?"
        >
          {t("session.status.sessionNotSaved")}
        </Modal>
      </>
    );
  }

  