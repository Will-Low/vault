/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: BUSL-1.1
 */

import { service } from '@ember/service';
import Component from '@glimmer/component';
import errorMessage from 'vault/utils/error-message';
import { tracked } from '@glimmer/tracking';

import type Store from '@ember-data/store';
import type SecretEngineModel from 'vault/models/secret-engine';
import type AdapterError from '@ember-data/adapter';
import type Model from '@ember-data/model';

/**
 * @module ConfigurableSecretEngineDetails
 * `ConfigurableSecretEngineDetails` is used by configurable secret engines (AWS, SSH) to show either an API error, configuration details, or a prompt to configure the engine. Which of these is shown is determined by the engine type and whether the user has configured the engine yet.
 *
 * @example
 * ```js
 * <ConfigurableSecretEngineDetails @model={{this.model}} />
 * ```
 *
 * @param {object} model - The secret-engine model to be configured.
 */

interface Args {
  model: SecretEngineModel;
}

export default class ConfigurableSecretEngineDetails extends Component<Args> {
  @service declare readonly store: Store;
  @tracked configError: string | null = null;
  @tracked configModel: Model | null = null;

  constructor(owner: unknown, args: Args) {
    super(owner, args);
    const { model } = this.args;
    // Should not be able to get here without a model, but in case an upstream change allows it, catching the failure.
    if (!model) {
      this.configError =
        'We are unable to access the mount information for this engine. Ask you administrator if you think you should have access to this secret engine.';
      return;
    }
    const { id, type } = model;
    // Fetch the config for the engine type.
    switch (type) {
      case 'aws':
        this.fetchAwsRootConfig(id);
        break;
      case 'ssh':
        this.fetchSshCaConfig(id);
        break;
    }
  }

  async fetchAwsRootConfig(backend: string) {
    try {
      this.configModel = await this.store.queryRecord('aws/root-config', { backend });
    } catch (e: AdapterError) {
      // If the error is something other than 404 "not found" then an API error has come back and this will be displayed to the user as an error.
      // If it's 404 then configError is not set nor is the configModel and a prompt to configure will be shown.
      if (e.httpStatus !== 404) {
        this.configError = errorMessage(e);
      }
      return;
    }
  }

  async fetchSshCaConfig(backend: string) {
    try {
      this.configModel = await this.store.queryRecord('ssh/ca-config', { backend });
    } catch (e: AdapterError) {
      // The SSH api does not return a 404 not found but a 400 error after first mounting the engine with the
      // message that keys have not been configured yet.
      // We need to check the message of the 400 error and if it's the keys message, return a prompt instead of a configError.
      if (e.httpStatus !== 404 && errorMessage(e) !== `keys haven't been configured yet`) {
        this.configError = errorMessage(e);
      }
      return;
    }
  }

  get typeDisplay() {
    // Will eventually include GCP and Azure.
    // Did not use capitalize helper because some are all caps and some only title case (ex: Azure vs AWS).
    const { type } = this.args.model;
    switch (type) {
      case 'aws':
        return 'AWS';
      case 'ssh':
        return 'SSH';
      default:
        return type;
    }
  }
}
