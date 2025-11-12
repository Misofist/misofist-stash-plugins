//**
  type React = import('react')
  type ReactDOM = import('react-dom')
//*

interface IPluginAPI {
  React: typeof React;
  ReactDOM: typeof ReactDOM;
  GQL: any;
  Event: {
    addEventListener: (event: string, callback: (e: CustomEvent) => void) => void;
  };
  libraries: {
    ReactRouterDOM: {
      useLocation: () => any;
      useHistory: () => any;
      Link: React.FC<any>;
      Route: React.FC<any>;
      NavLink: React.FC<any>;
    },
    Bootstrap: {
      Button: React.FC<any>;
      Nav: React.FC<any> & {
        Link: React.FC<any>;
      };
    },
    FontAwesomeSolid: {[name: string]: any},
    Intl: {
      FormattedMessage: React.FC<any>;
      useIntl: () => any;
    }
  },
  loadableComponents: any;
  components: Record<string, React.FC<any>>;
  utils: {
    NavUtils: any;
    loadComponents: any;
    StashService: any;
  },
  hooks: any;
  patch: {
    before: (target: string, fn: Function) => void;
    instead: (target: string, fn: Function) => void;
    after: (target: string, fn: Function) => void;
  },
  register: {
    route: (path: string, component: React.FC<any>) => void;
  }
}

interface Window {
  PluginApi: PluginAPI
}