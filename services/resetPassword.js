const async = require("async");
const { Users } = require("../models/userSchema");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const handlePasswordReset = (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      statusCode: 400,
      message: { error: "Invalid credential" },
    });
  }

  async.waterfall(
    [
      (done) => {
        crypto.randomBytes(20, (err, buff) => {
          const token = buff.toString("hex");
          done(err, token);
        });
      },

      (token, done) => {
        Users.findOne({ email }, (err, user) => {
          if (!user) {
            return res.status(400).json({
              statusCode: 400,
              message: {
                error: "No record is associated with this email address",
              },
            });
          }

          //set user passwordToken to generated token
          user.resetPasswordToken = token;
          user.resetPasswordExpires = Date.now() + 3600000; // 1hr

          user.save((err) => {
            done(err, token, user);
          });
        });
      },

      (token, user, done) => {
        //SEND EMAIL WITH NODEMAILER
        const transporter = nodemailer.createTransport({
          host: process.env.MAIL_HOST,
          port: 587,
          auth: {
            user: "apikey",
            pass: process.env.SEND_GRID_PASSWORD,
          },
          tls: {
            rejectUnauthorized: false,
          },
        });

        const textHTML = `
        <h2> Chatty Password Reset Notification </h2>
        <main> 
        <p><b>You are receiving this because you (or someone esle) have requested the reset of your account password.<b><br/>
        Please click on the following link, or paste this into your browser to complete the process: http://${req.headers.host}/api.chatty/w/reset/${token}
        </p>

        <p>If you did not request this, please ignore this email and your password will remain unchanged</p>
        </main>
        `;

        const mailOptions = {
          to: user.email,
          from: "developer.gemjoshua@gmail.com",
          subject: "Chatty Password Reset Notification",
          text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n
          Please click on the following link, or paste this into your browser to complete the process:\n\nhttp://${req.headers.host}/api.chatty/w/reset/${token}\n\n
          If you did not request this, please ignore this email and your password will remain unchanged.\n`,
          html: textHTML,
        };

        transporter.sendMail(mailOptions, (err, info) => {
          if (err) throw err;
          console.log("Email Sent Response: ", info.response);

          res.status(200).json({
            statusCode: 200,
            message: {
              success:
                "Instructions for your request has been sent to your email",
            },
          });
        });

        /*
        =====================================
        SENDGRID OPTION
        =====================================
        */
        // const gridTransporter = sendGrid.setApiKey(
        //   process.env.SENDGRID_API_KEY
        // );

        // gridTransporter
        //   .send(mailOptions)
        //   .then(() => {
        //     console.log("Mail sent!");
        //     res.status(200).json({ success: "Mail Sent Successfully" });
        //   })
        //   .catch((err) => {
        //     if (err) throw err;
        //     res.status(500).json({ error: err.message });
        //   });
      },
    ],
    (err) => {
      if (err) {
        console.log("Error: ", err);
      }
    }
  );
};

module.exports = handlePasswordReset;
