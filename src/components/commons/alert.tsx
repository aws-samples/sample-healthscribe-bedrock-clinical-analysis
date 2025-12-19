import * as React from "react";
import Alert from "@cloudscape-design/components/alert";
import {useTranslation} from 'react-i18next';

export default () => {
  const { t } = useTranslation();
  return (
    <Alert
      dismissible
      statusIconAriaLabel="Info"
      header={
        <React.Fragment>
          {t("ui.messages.disclaimerAIGenerated")}
        </React.Fragment>
      }
    />
  );
}