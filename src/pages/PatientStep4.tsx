// PatientStep4.tsx
import React, { useEffect, useState } from 'react';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import Textarea from '@cloudscape-design/components/textarea';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import { getFinalSummary, updateVisitData } from '../services/visitService';
import Alert from '@cloudscape-design/components/alert';
import {useTranslation} from 'react-i18next';

interface PatientStep4Props {
  sessionId: string | null;
}

interface VisitData {
  visitId: string;
  dataCategory: string;
  assessment: string;
  chief_complaint: string;
  history_present_illness: string;
  plan: string;
  review_systems: string;
}

const PatientStep4: React.FC<PatientStep4Props> = ({ sessionId }) => {
    const [summaryData, setSummaryData] = useState({
        assessment: '',
        chief_complaint: '',
        history_present_illness: '',
        plan: '',
        review_systems: ''
      });
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (sessionId) {
        fetchCareSummary();
    } else {
        setError('No session ID available. Please complete previous steps first.');
        setLoading(false);
    }
}, [sessionId]);

  const fetchCareSummary = async () => {
    if (!sessionId) {
        setError('No session ID available');
        setLoading(false);
        return;
    }

    try {
        setLoading(true);
        setError(null);
        const data = await getFinalSummary(sessionId); // Use sessionId instead of hardcoded value
        console.log('Fetched care summary data:', data);
        // Find the item with dataCategory "finalSummary"
        const finalSummaryItem = data.find(item => item.dataCategory === "finalSummary");
        if (finalSummaryItem) {
            setSummaryData({
                assessment: finalSummaryItem.assessment ? JSON.parse(finalSummaryItem.assessment) : '',
                chief_complaint: finalSummaryItem.chief_complaint ? JSON.parse(finalSummaryItem.chief_complaint) : '',
                history_present_illness: finalSummaryItem.history_present_illness ? JSON.parse(finalSummaryItem.history_present_illness) : '',
                plan: finalSummaryItem.plan ? JSON.parse(finalSummaryItem.plan) : '',
                review_systems: finalSummaryItem.review_systems ? JSON.parse(finalSummaryItem.review_systems) : ''
            });
        }
    } catch (err) {
        setError('Failed to load care summary. Please try again.');
        console.error('Error fetching care summary:', err);
    } finally {
        setLoading(false);
    }
  };
  

  const handleSave = async () => {
    if (!sessionId) {
        setError('No session ID available');
        return;
    }

    try {
        setError(null);
        const formattedData = {
            assessment: JSON.stringify(summaryData.assessment),
            chief_complaint: JSON.stringify(summaryData.chief_complaint),
            history_present_illness: JSON.stringify(summaryData.history_present_illness),
            plan: JSON.stringify(summaryData.plan),
            review_systems: JSON.stringify(summaryData.review_systems)
        };
        await updateVisitData(sessionId, formattedData);
        setIsEditing(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
        setError('Failed to save changes. Please try again.');
        console.error('Error saving care summary:', err);
    }
};

  const handleEdit = () => {
    setIsEditing(true); 
    setSaveSuccess(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    fetchCareSummary(); // Reset to original content
  };

  const handleChange = (field: string, value: string) => {
    setSummaryData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (!sessionId) {
    return (
        <Container>
            <Alert type="error">
                {t("session.errors.noSessionID")}
            </Alert>
        </Container>
    );
}

  return (
    <SpaceBetween size="m">
      {error && (
        <Alert type="error" dismissible onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {saveSuccess && (
        <Alert type="success" dismissible onDismiss={() => setSaveSuccess(false)}>
          {t("session.status.changesSaved")}
        </Alert>
      )}

      <Container
        header={
          <Header
            variant="h2"
            actions={
              <SpaceBetween direction="horizontal" size="m">
                {isEditing ? (
                  <>
                   <SpaceBetween direction="horizontal" size="xs">
                    <Button onClick={handleCancel}>{t("ui.buttons.cancel")}</Button>
                    <Button variant="primary" onClick={handleSave}>{t("ui.buttons.save")}</Button>
                  </SpaceBetween>  
                  </>
                ) : (
                  <Button onClick={handleEdit}>{t("ui.buttons.edit")}</Button>
                )}
              </SpaceBetween>
            }
          >
            {t("ui.headers.careSummary")}
          </Header>
        }
      >
        {loading ? (
          <div>{t("session.loading.loadingCareSummary")}</div>
        ) : (
            <SpaceBetween size="m">
            <Container header={<Header variant="h3">{t("medical.soap.chiefComplaint")}</Header>}>
              <Textarea
                value={summaryData.chief_complaint}
                onChange={({ detail }) => handleChange('chief_complaint', detail.value)}
                disabled={!isEditing}
                rows={3}
              />
            </Container>

            <Container header={<Header variant="h3">{t("medical.soap.historyOfPresentIllness")}</Header>}>
              <Textarea
                value={summaryData.history_present_illness}
                onChange={({ detail }) => handleChange('history_present_illness', detail.value)}
                disabled={!isEditing}
                rows={5}
              />
            </Container>

            <Container header={<Header variant="h3">{t("medical.soap.reviewOfSystems")}</Header>}>
              <Textarea
                value={summaryData.review_systems}
                onChange={({ detail }) => handleChange('review_systems', detail.value)}
                disabled={!isEditing}
                rows={5}
              />
            </Container>

            <Container header={<Header variant="h3">{t("medical.soap.assessment")}</Header>}>
              <Textarea
                value={summaryData.assessment}
                onChange={({ detail }) => handleChange('assessment', detail.value)}
                disabled={!isEditing}
                rows={4}
              />
            </Container>

            <Container header={<Header variant="h3">{t("medical.soap.plan")}</Header>}>
              <Textarea
                value={summaryData.plan}
                onChange={({ detail }) => handleChange('plan', detail.value)}
                disabled={!isEditing}
                rows={4}
              />
            </Container>
          </SpaceBetween>
        )}
      </Container>
    </SpaceBetween>
  );
};

export default PatientStep4;
