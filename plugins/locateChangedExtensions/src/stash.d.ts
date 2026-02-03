interface GraphQLError {
  message: string;
  locations: Array<GraphQLErrorLocation>;
  path?: Array<string>;
}

interface GraphQLErrorLocation {
  line: number;
  column: number;
}

type GraphQLDefaultInputVariables = {[variableName: string]: any};

type GraphQLQueryFunction = <InputType extends GraphQLDefaultInputVariables, ResultType extends {}>(queryOrMutation: string, variables?: InputType) => ResultType;

interface Logger {
  Trace: (string: string) => void;
  Debug: (string: string) => void;
  Info: (string: string) => void;
  Warn: (string: string) => void;
  Error: (string: string) => void;
  Progress: (percentage: number) => void;
}

interface GQL {
  Do: GraphQLQueryFunction;
}

interface Utils {
  Sleep: (milliseconds: number) => void;
}

type DefaultPluginArguments = {[argKey: string]: string};

interface ServerConnection {
  Scheme: "http" | "https";
  Port: number;
  Dir: string;
  PluginDir: string;
  SessionCookie: SessionCookie;
}

interface SessionCookie {
  Name: string;
  Value: string;
  Path: string;
  Domain: string;
  Expires: string;
  RawExpires: number;
  MaxAge: number;
  Secure: boolean;
  HttpOnly: boolean;
  SameSite: number;
  Raw: string;
  Unparsed: null;
}

interface PluginInput<PluginArguments extends DefaultPluginArguments> {
  server_connection: ServerConnection;
  Args: PluginArguments;
}

interface PluginOutput<Output extends any> {
  error?: string;
  output?: Output;
}

declare var log: Logger;
declare var gql: GQL;
declare var util: Utils;
declare var input: PluginInput<any>;