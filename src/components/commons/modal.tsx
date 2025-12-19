import * as React from "react";
import Modal from "@cloudscape-design/components/modal";
import Box from "@cloudscape-design/components/box";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Button from "@cloudscape-design/components/button";
import {useTranslation} from 'react-i18next';

export const ConsentModal = ({ visible, setVisible }) => {
    const { t } = useTranslation();
    return (
      <Modal
        onDismiss={() => setVisible(false)}
        visible={visible}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setVisible(false)}>
                {t("ui.buttons.cancel")}
              </Button>
              <Button variant="primary">{t("ui.buttons.confirmed")}</Button>
            </SpaceBetween>
          </Box>
        }
        header={<React.Fragment>{t("ui.headers.recordingConsent")}</React.Fragment>}
      >
        {t("session.actions.advisePatient")}
      </Modal>
    );
  };