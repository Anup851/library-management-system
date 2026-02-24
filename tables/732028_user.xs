// Stores user information and allows the user to authenticate  against
table user {
  auth = true

  schema {
    int id
    timestamp created_at?=now
    text name filters=trim
    email? email filters=trim|lower
    password? password filters=min:8|minAlpha:1|minDigit:1
  
    // The role of the user within their company (e.g., 'admin', 'member').
    enum role? {
      values = ["admin", "student", "parent"]
    }
  
    // Reference to the company the user belongs to.
    int account_id? {
      table = "account"
    }
  
    object password_reset? {
      schema {
        password token?
        timestamp? expiration?
        bool used?
      }
    }
  
    text password_hash?
  
    // Phone number of the user.
    text phone? filters=trim
  
    // References the student record if the user's role is 'student'.
    int student_id? {
      table = "student"
    }
  
    // References a list of student records if the user's role is 'parent'.
    int[] child_ids? {
      table = "student"
    }
  }

  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree", field: [{name: "created_at", op: "desc"}]}
    {type: "btree|unique", field: [{name: "email", op: "asc"}]}
  ]

  tags = ["xano:quick-start"]
}