import React from 'react';
import SubmitButton from '../components/ui/SubmitButton';

export default {
  title: 'UI/SubmitButton',
  component: SubmitButton,
  parameters: {
    docs: {
      description: {
        component: 'A versatile submit button component with loading states and variants.'
      }
    }
  },
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'danger']
    },
    onClick: { action: 'clicked' },
    children: { control: 'text' }
  }
};

const Template = (args) => <SubmitButton {...args} />;

export const Primary = Template.bind({});
Primary.args = {
  children: 'Submit',
  variant: 'primary'
};

export const Secondary = Template.bind({});
Secondary.args = {
  children: 'Cancel',
  variant: 'secondary'
};

export const Danger = Template.bind({});
Danger.args = {
  children: 'Delete',
  variant: 'danger'
};

export const Loading = Template.bind({});
Loading.args = {
  children: 'Submitting...',
  loading: true,
  variant: 'primary'
};

export const Disabled = Template.bind({});
Disabled.args = {
  children: 'Disabled',
  disabled: true,
  variant: 'primary'
};

export const AllStates = () => (
  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
    <SubmitButton variant="primary">Default</SubmitButton>
    <SubmitButton variant="primary" loading>Loading</SubmitButton>
    <SubmitButton variant="primary" disabled>Disabled</SubmitButton>
    <SubmitButton variant="secondary">Secondary</SubmitButton>
    <SubmitButton variant="danger">Danger</SubmitButton>
  </div>
);
